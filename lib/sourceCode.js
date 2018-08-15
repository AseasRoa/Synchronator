"use strict"

const bracketsMap = {
	')' : '(',
	'}' : '{',
	']' : '[',
	'>' : '<'
}

function SC() {

}

SC.prototype = {
	stripComments: function(str)
	{
		// http://james.padolsey.com/demos/comment-removal-js.html

		var uid        = "_" + +new Date()
		var primatives = []
		var primIndex  = 0
		var retval     = ""

		retval =
			str

			/* Remove strings */
			.replace(/([\'\"])(\\\1|.)+?\1/g, function(match){
				primatives[primIndex] = match;
				return (uid + "") + primIndex++;
			})

			/* Remove Regexes */
			// TODO this matches code like var a = 1/2 + 2/4;
			// TODO fix it in a way, so before the first / it must be ( or =
			// TODO maybe this: ([\=\(][ ]*)(\/(?!\*|\/)(?:\\\/|.)+?\/[gim]{0,3})
			.replace(/([^\/])(\/(?!\*|\/)(\\\/|.)+?\/[gim]{0,3})/g, function(match, $1, $2){
				primatives[primIndex] = $2;
				return $1 + (uid + "") + primIndex++;
			})

			/*
			 - Remove single-line comments that contain would-be multi-line delimiters
			 E.g. // Comment /* <--
			 // TODO I found that this second scenario doesn't always work correctly and that's why I remove this regex
			 - Remove multi-line comments that contain would be single-line delimiters
			 E.g. /* // <--
			 */
			//.replace(/\/\/.*?\/?\*.+?(?=\n|\r|$)|\/\*[\s\S]*?\/\/[\s\S]*?\*\//g, "")

			/*
			 Remove single and multi-line comments,
			 no consideration of inner-contents
			 */
			.replace(/\/\/.+?(?=\n|\r|$)|\/\*[\s\S]+?\*\//g, "")

			/*
			 Remove multi-line comments that have a replace ending (string/regex)
			 Greedy, so no inner strings/regexes will stop it.
			 */
			.replace(RegExp("\\/\\*[\\s\\S]+" + uid + "\\d+", "g"), "")

			/* Bring back strings & regexes */
			.replace(RegExp(uid + "(\\d+)", "g"), function(match, n){
				return primatives[n];
			})

		//if (str.length == 4600) log(retval)

		return retval
	},
	/*stripHtmlTags: function(input) {
		input = input.replace(/<[^>]+>/ig, '')
		return input
	},*/

	stripHtmlTags: function(str, allow)
	{
		if (typeof str !== "string") {
			str = ""
		}
		// http://locutus.io/php/strings/strip_tags/

		// "allow" can be a string like '<b><i>'

		// making sure the allow arg is a string containing only tags in lowercase (<a><b><c>)
		allow = (((allow || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');

		var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi

		var commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
		return str.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
			return (allow.indexOf('<' + $1.toLowerCase() + '>') > -1) ? $0 : '';
		});
	},

	extractFunctionCalls: function(code, reserved)
	{
		// returns an object where keys are the names of the functions and values are the arguments

		code = this.stripComments(code)

		reserved = reserved || ['if', 'for', 'while', 'return', 'break', 'continue', 'switch', 'do', 'new', 'delete', 'false', 'true']

		var functions = {}
		var pattern = /([\w]+)\s*\(/g

		var match = null

		while (match = pattern.exec(code))
		{
			if (reserved.indexOf(match[1]) > -1) continue
			if (!functions[match[1]]) functions[match[1]] = 0
			functions[match[1]]++
		}

		for (var i in functions)
		{
			if (reserved.indexOf(functions[i]) > -1) delete functions[i]
		}

		return functions
	},

	indent: function(code, symbols_count, symbol)
	{
		symbol = symbol || "\t"
		symbols_count = symbols_count || 1

		var indent_data = ''
		for (var i=0; i < symbols_count; i++) indent_data += symbol

		return code.replace(/\n/g, "\n" + indent_data)
	},

	replaceVariableName: function(from, to, code)
	{
		var pattern = new RegExp('([^A-Za-z0-9_])'+from+'([^A-Za-z0-9_(])', 'g')

		code = ' ' + code + ' '
		code = code.replace(pattern, '$1' + to + '$2')

		code = code.substring(1, code.length-1)

		return code
	},

	extractVariableNames: function(code, reserved)
	{
		// returns list of variables where keys are the name of the variable and values are how many times they were found

		reserved = reserved || ['if', 'for', 'while', 'return', 'break', 'continue', 'switch', 'do', 'new', 'delete', 'false', 'true']

		var retval  = {}
		var pattern = /([A-Za-z_][A-Za-z0-9_]*)\s*([^A-Za-z0-9_\$\(\'\"\s]|$)/gi

		var match = null

		while(match = pattern.exec(code))
		{
			if (reserved.indexOf(match[1]) > -1) continue
			if (!(match[1] in retval)) retval[match[1]] = 1
			else retval[match[1]]++
		}

		return retval
	},

	findClosingBracket: function(code, closingbracket, nth, start_pos)
	{
		var openbracket = bracketsMap[closingbracket]
		if (!openbracket || !closingbracket) {return new Error("Declare brackets, please")}

		nth = nth || 1
		start_pos = start_pos || 0

		var i   = 0 // offset
		var cnt = 0 // how many { were found and need to be matched with }. When } is found and this is 0, this is our }
		var found = false

		// for (var i in code) => if I use this, then i is a string
		for (i = start_pos; i < code.length; i++)
		{
			if (code[i] == openbracket) {
				cnt++
			}
			else if (code[i] == closingbracket)
			{
				if (cnt == 0)
				{
					nth--
					if (nth == 0)
					{
						found = true

						break
					}
				}
				else
				{
					cnt--
				}
			}
		}

		return ((found) ? i : -1)
	},

	//-- Stringies = String, Comments, Regexes --------------------------------------------------------------------------

	// create map of stringies
	stringies: function(code)
	{
		var positions = []

		var pos1

		var in_string   = false       // whether or not we are inside string
		var string_type = ""          // ', " or `

		var in_comment       = false  // whether or not we are inside comment
		var comment_multiline = false // false = single line, true = multi line

		var in_regex = false          // whether or not we are in regex
		var regex_closing_idx = -1    // remembers the end / of a regex, used to prevent detection of new regex with the closing /

		// Regexes are special. We don't want to detect stuff like this: var a = 1/2 + 2/4;
		// So, we only can say that something in between / and / is regex if there is = or ( just before the first /
		// The following variables must help to detect this
		var non_empty_symbol_before_regex = "(" // we start with something, because the code could start directly with the first regex /

		var slashes = 0 // 0 when reset. When collecting symbols it is 1 or 2 (1 for \ or \\\ and so on, or 2 for \\ or \\\\ and so on)

		var bracket_detected = false // this works best for strings, slows down for comments

		for (var i = 0; i <= code.length; i++)
		{
			var symbol = code[i]

			//-- checking comments -------------------------------------------------------------------------------------
			if (!in_regex && !in_string)
			{
				if (!in_comment)
				{
					if (i > 0 && code[i - 1] === '/')
					{
						if (symbol === '/')
						{
							in_comment        = true
							comment_multiline = false
							pos1              = i - 1 // because of the double //

							continue
						}
						else if (symbol === "*")
						{
							in_comment        = true
							comment_multiline = true
							pos1              = i - 1 // because of the double /*

							continue
						}
					}
				}
				else
				{
					if (comment_multiline === false)
					{
						if (symbol === '\r' || symbol === '\n')
						{
							in_comment = false
							positions.push({type:"comment", position:[pos1, i-1]}) // minus one symbol because of new line
						}
					}
					else
					{
						if (code[i - 1] === '*' && symbol === '/')
						{
							in_comment = false
							positions.push({type:"comment-multiline", position:[pos1, i]})
							i++ // because of the double symbol
						}
					}

					continue
				}
			}

			//-- checking regex ----------------------------------------------------------------------------------------
			// check regexes before strings because this creates troubles if it's first detected by strings: /['"]/
			if (!in_string && !in_comment)
			{
				if (!in_regex)
				{
					if (i > 0 && (i > regex_closing_idx + 1) && symbol !== "/" && code[i - 1] === "/")
					{
						if (
								non_empty_symbol_before_regex === "("
								|| non_empty_symbol_before_regex === "="
								|| non_empty_symbol_before_regex === "{"
								|| non_empty_symbol_before_regex === "["
								|| non_empty_symbol_before_regex === ":"
								|| non_empty_symbol_before_regex === "|"
								|| non_empty_symbol_before_regex === "&"
								|| non_empty_symbol_before_regex === "!"
								|| non_empty_symbol_before_regex === ">"
								|| non_empty_symbol_before_regex === "<"
								|| non_empty_symbol_before_regex === "+"
								|| non_empty_symbol_before_regex === "-"
						)
						{
							in_regex = true
							pos1     = i - 1 // because of the double /x
							non_empty_symbol_before_regex = "" // we just found a regex, reset this here to prevent regex detections inside the regex

							if (symbol === "\\") {
								// we are in the first symbol in the regex already, so if it is a backslash, increment this
								slashes++
							}

							continue
						}
					}

					if (symbol !== " ")
					{
						if (symbol !== "/")
						{
							non_empty_symbol_before_regex = symbol
						}

					}
				}
				else
				{
					if (slashes > 0) {
						slashes = 0
						continue
					}
					else
					{
						if (symbol === "\\")
						{
							slashes++
						}
					}

					if (symbol === "/")
					{
						if (code[i - 1] !== "\\" || slashes === 0)
						{
							regex_closing_idx = i
							in_regex          = false
							slashes           = 0
							positions.push({type: "regex", position: [pos1, i]})

							i++ // because of the double symbol
						}
					}

					continue
				}
			}

			//-- checking strings --------------------------------------------------------------------------------------
			if (!in_regex && !in_comment)
			{
				if (!in_string)
				{
					if (symbol === '"' || symbol === "'" || symbol === "`")
					{
						in_string   = true
						string_type = symbol
						pos1 = i

						continue
					}
				}
				else
				{
					if (bracket_detected === false)
					{
						if (
								   symbol === "(" || symbol === ")"
								|| symbol === "{" || symbol === "}"
								|| symbol === "[" || symbol === "]"
								|| symbol === "/"
								|| symbol === ";"
								|| symbol === ","
						)
						{
							bracket_detected = true
						}
					}

					if (slashes > 0) {
						slashes = 0
						continue
					}
					else
					{
						if (symbol === "\\")
						{
							slashes++
						}
					}

					if (symbol === string_type)
					{
						if (i > 0)
						{
							if (
								(code[i - 1] !== "\\" || slashes === 0)
							)
							{
								in_string   = false
								slashes     = 0

								if (1 || bracket_detected)
								{
									if (i - pos1 > 1)
									{
										positions.push({type: "string-" + string_type, position: [pos1, i]})
									}
								}
								bracket_detected = false
								string_type = ""
								//string_contains_special_char = false
							}
						}
					}

					continue
				}
			}
		}

		return positions
	},

	// replace stringies with timestamps, so they don't contain sensitive data
	stringiesEncode: function(code)
	{
		var positions = this.stringies(code)
		var map       = {}
		var map2      = {}

		if (positions.length > 0)
		{
			var grandword = new Date().getTime()

			var codeOut = ""
			var posLast = 0

			for (var i = 0; i < positions.length; i++)
			{
				var type = positions[i].type
				var pos1 = positions[i].position[0]
				var pos2 = positions[i].position[1]
				var original_chunk = code.substring(pos1, pos2 + 1)
				var word = ""

				for (let j in map)
				{
					if (map[j].replacement === original_chunk)
					{
						word = j

						break
					}
				}

				if (word === "")
				{
					var keyword = grandword + i

					switch(type)
					{
						case "comment"           : word = "//" + keyword; break
						case "comment-multiline" : word = "/*" + keyword + "*/"; break
						case "string-'"          : word = "'" + keyword + "'"; break
						case 'string-"'          : word = '"' + keyword + '"'; break
						case 'string-`'          : word = '`' + keyword + '`'; break
						case "regex"             : word = "/" + keyword + "/"; break
					}

					map[word] = {occurence : 0, replacement : original_chunk}
				}

				map[word]["occurence"]++

				codeOut += code.substring(posLast, pos1) + word
				posLast = pos2 + 1

				if (i === positions.length - 1) {
					codeOut += code.substr(pos2 + 1)
				}
			}
		}
		else {
			codeOut = code
		}

//log(map)
//log(Object.keys(map).length + " " + Object.keys(map2).length)

		return {
			positions : positions,
			map  : map,
			code : codeOut
		}
	},

	/**
	 *
	 * @param code
	 * @param stringiesMap - Key-Value pairs where the key is the string to search for and the value is the replacement string. Keys MUST be sorted in the code and in the map, because this function starts from the beginning of the code and never looks back.
	 * @returns {string}
	 */
	stringiesDecode: function(code, stringiesMap)
	{
		//-- pass 1: replace everything that can be found multiple times in the code
		for (var keyword in stringiesMap)
		{
			if (stringiesMap[keyword]["occurence"] != 1)
			{
				code = code.split(keyword).join(stringiesMap[keyword]["replacement"])
			}
		}

		//-- pass 2: replace everything that can be found only once using the fastest method
		var offset  = 0
		var pos     = 0
		var codeout = ""

		for (var keyword in stringiesMap)
		{
			if (stringiesMap[keyword]["occurence"] != 1) continue

			pos = code.indexOf(keyword, offset)

			if (pos > -1)
			{
				codeout += code.substring(offset, pos) + stringiesMap[keyword]["replacement"]

				offset = pos + keyword.length
			}
			else {
				// if I test the code below, stringies are put out of order and one of them fails to be replaced.
				// That's why I'm using the normal replace() here
				/*
				 a:function(r){
				 //
				 var a={}
				 var b={}
				 var ab={}
				 },
				 _buildExternsClass:function(externs){},
				 c:function*(){v.replace(g,(a,b)=>{})}
				 */
				// Even with this, the process is way faster, compared with using only replace()
				codeout = codeout.replace(keyword, stringiesMap[keyword]["replacement"])
			}

			delete stringiesMap[keyword]
		}

		codeout += code.substr(offset)

		return codeout
	}
}

module.exports = new SC()