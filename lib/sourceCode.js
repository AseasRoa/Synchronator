"use strict"

const bracketsMap = {
	')' : '(',
	'}' : '{',
	']' : '[',
	'>' : '<'
}

class SC
{
	/**
	 * @param {string} code
	 * @returns {string}
	 */
	stripComments(code) {
		let str = ('__' + code + '__').split('')

		var mode = {
			singleQuote	: false,
			doubleQuote	: false,
			regex			: false,
			blockComment: false,
			lineComment	: false,
			condComp		: false
		}

		for (var i = 0, l = str.length; i < l; i++)
		{
			if (mode.regex) {
				if (str[i] === '/' && str[i-1] !== '\\') {
					mode.regex = false
				}
				continue
			}

			if (mode.singleQuote) {
				if (str[i] === "'" && str[i-1] !== '\\') {
					mode.singleQuote = false
				}
				continue
			}

			if (mode.doubleQuote) {
				if (str[i] === '"' && str[i-1] !== '\\') {
					mode.doubleQuote = false
				}
				continue
			}

			if (mode.blockComment) {
				if (str[i] === '*' && str[i+1] === '/') {
					str[i+1] = ''
					mode.blockComment = false
				}
				str[i] = ''
				continue
			}

			if (mode.lineComment) {
				if (str[i+1] === '\n' || str[i+1] === '\r') {
					mode.lineComment = false
				}
				str[i] = ''
				continue
			}

			if (mode.condComp) {
				if (str[i-2] === '@' && str[i-1] === '*' && str[i] === '/') {
					mode.condComp = false
				}
				continue
			}

			mode.doubleQuote = str[i] === '"'
			mode.singleQuote = str[i] === "'"

			if (str[i] === '/') {

				if (str[i+1] === '*' && str[i+2] === '@') {
					mode.condComp = true
					continue
				}
				if (str[i+1] === '*') {
					str[i] = ''
					mode.blockComment = true
					continue
				}
				if (str[i+1] === '/') {
					str[i] = ''
					mode.lineComment = true
					continue
				}
				mode.regex = true

			}
		}

		return str.join('').slice(2, -2).trim()
	}

	/**
	 *
	 * @param {string} htmlCode
	 * @param {string} [allow] - can be a string like '<b><i>'
	 *
	 * @returns {string}
	 */
	stripHtmlTags(htmlCode, allow = "")
	{
		if (typeof htmlCode !== "string")
		{
			htmlCode = ""
		}
		// http://locutus.io/php/strings/strip_tags/

		// making sure the allow arg is a string containing only tags in lowercase (<a><b><c>)
		allow = (((allow || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('')

		let tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
		let commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi

		return htmlCode.replace(commentsAndPhpTags, '')
		               .replace(tags, function ($0, $1) {
			               return (allow.indexOf('<' + $1.toLowerCase() + '>') > -1)
				               ? $0
				               : ''
		               })
	}

	/**
	 * @param {string} code
	 * @param {Array | null} reservedFunctionNames
	 *
	 * @returns {string}
	 */
	extractFunctionCalls(code, reservedFunctionNames = null)
	{
		// returns an object where keys are the names of the functions and values are the arguments

		code = this.stripComments(code)

		reservedFunctionNames = reservedFunctionNames || ['if', 'for', 'while', 'return', 'break', 'continue', 'switch', 'do', 'new', 'delete', 'false', 'true']

		let functions = {}
		let pattern   = /([\w]+)\s*\(/g

		while (true)
		{
			let match = pattern.exec(code)

			if (match === null)
			{
				break
			}

			if (reservedFunctionNames.indexOf(match[1]) > -1) continue
			if (!functions[match[1]]) functions[match[1]] = 0

			functions[match[1]]++
		}

		for (let i in functions)
		{
			if (reservedFunctionNames.indexOf(functions[i]) > -1) delete functions[i]
		}

		return functions
	}

	/**
	 * @param {string} code
	 * @param {number} symbolsCount
	 * @param symbol
	 *
	 * @returns {string}
	 */
	indent(code, symbolsCount = 1, symbol = "\t")
	{
		let indentData = ''

		for (let i = 0; i < symbolsCount; i++)
		{
			indentData += symbol
		}

		return code.replace(/\n/g, "\n" + indentData)
	}

	replaceVariableName(from, to, code)
	{
		let pattern = new RegExp('([^A-Za-z0-9_])' + from + '([^A-Za-z0-9_(])', 'g')

		code = ' ' + code + ' '
		code = code.replace(pattern, '$1' + to + '$2')

		code = code.substring(1, code.length - 1)

		return code
	}

	extractVariableNames(code, reserved)
	{
		// returns list of variables where keys are the name of the variable and values are how many times they were found

		reserved = reserved || ['if', 'for', 'while', 'return', 'break', 'continue', 'switch', 'do', 'new', 'delete', 'false', 'true']

		let output  = {}
		let pattern = /([A-Za-z_][A-Za-z0-9_]*)\s*([^A-Za-z0-9_\$\(\'\"\s]|$)/gi

		while (true)
		{
			let match = pattern.exec(code)

			if (match === null)
			{
				break
			}

			if (reserved.indexOf(match[1]) > -1) continue
			if (!(match[1] in output))
			{
				output[match[1]] = 1
			}
			else
			{
				output[match[1]]++
			}
		}

		return output
	}

	findClosingBracket(code, closingBracket, nth, startingPosition)
	{
		let openbracket = bracketsMap[closingBracket]

		if (!openbracket || !closingBracket)
		{
			return new Error("Declare brackets, please")
		}

		nth              = nth || 1
		startingPosition = startingPosition || 0

		let offset = 0 // offset
		let cnt    = 0 // how many { were found and need to be matched with }. When } is found and this is 0, this is our }
		let found  = false

		// for (let offset in code) => if I use this, then offset is a string
		for (offset = startingPosition; offset < code.length; offset++)
		{
			if (code[offset] === openbracket)
			{
				cnt++
			}
			else if (code[offset] === closingBracket)
			{
				if (cnt === 0)
				{
					nth--
					if (nth === 0)
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

		return ((found) ? offset : -1)
	}

	//-- Stringies = String, Comments, Regexes --------------------------------------------------------------------------

	/**
	 * Create map of stringies
	 *
	 * @param {string} code
	 * @returns {Array<{type: string, position:number[]}>}
	 */
	stringies(code)
	{
		let positions = []

		let pos1               = 0
		let stringType         = ""    // ', " or `
		let inString           = false // whether we are inside string
		let inComment          = false // whether we are inside comment
		let isCommentMultiline = false // false = single line, true = multi line
		let inRegex            = false // whether we are in regex
		let regexClosingIndex  = -1    // remembers the end / of a regex, used to prevent detection of new regex with the closing /

		// Regexes are special. We don't want to detect stuff like this: var a = 1/2 + 2/4;
		// So, we can only say that something in between / and / is regex if there is = or ( just before the first /
		// The following variables must help to detect this
		let nonEmptySymbolBeforeRegex = "(" // we start with something, because the code could start directly with the first regex /

		let slashes           = 0     // 0 when reset. When collecting symbols it is 1 or 2 (1 for \ or \\\ and so on, or 2 for \\ or \\\\ and so on)
		let isBracketDetected = false // this works best for strings, slows down for comments

		for (let i = 0; i <= code.length; i++) {
			let symbol = code[i]

			//-- checking comments -------------------------------------------------------------------------------------
			if (!inRegex && !inString) {
				if (!inComment) {
					if (i > 0 && code[i - 1] === '/') {
						if (symbol === '/') {
							inComment          = true
							isCommentMultiline = false
							pos1               = i - 1 // because of the double //

							continue
						}
						else if (symbol === "*") {
							inComment          = true
							isCommentMultiline = true
							pos1               = i - 1 // because of the double /*

							continue
						}
					}
				}
				else {
					if (isCommentMultiline === false) {
						if (symbol === '\r' || symbol === '\n') {
							inComment = false
							positions.push({type : "comment", position : [pos1, i - 1]}) // minus one symbol because of new line
						}
					}
					else {
						if (code[i - 1] === '*' && symbol === '/') {
							inComment = false
							positions.push({type : "comment-multiline", position : [pos1, i]})
							i++ // because of the double symbol
						}
					}

					continue
				}
			}

			//-- checking regex ----------------------------------------------------------------------------------------
			// check regexes before strings because this creates troubles if it's first detected by strings: /['"]/
			if (!inString && !inComment) {
				if (!inRegex) {
					if (i > 0 && (i > regexClosingIndex + 1) && symbol !== "/" && code[i - 1] === "/") {
						if (
							nonEmptySymbolBeforeRegex === "("
							|| nonEmptySymbolBeforeRegex === "="
							|| nonEmptySymbolBeforeRegex === "{"
							|| nonEmptySymbolBeforeRegex === "["
							|| nonEmptySymbolBeforeRegex === ":"
							|| nonEmptySymbolBeforeRegex === "|"
							|| nonEmptySymbolBeforeRegex === "&"
							|| nonEmptySymbolBeforeRegex === "!"
							|| nonEmptySymbolBeforeRegex === ">"
							|| nonEmptySymbolBeforeRegex === "<"
							|| nonEmptySymbolBeforeRegex === "+"
							|| nonEmptySymbolBeforeRegex === "-"
						) {
							inRegex                   = true
							pos1                      = i - 1 // because of the double /x
							nonEmptySymbolBeforeRegex = "" // we just found a regex, reset this here to prevent regex detections inside the regex

							if (symbol === "\\") {
								// we are in the first symbol in the regex already, so if it is a backslash, increment this
								slashes++
							}

							continue
						}
					}

					if (symbol !== " ") {
						if (symbol !== "/") {
							nonEmptySymbolBeforeRegex = symbol
						}
					}
				}
				else
				{
					if (slashes > 0) {
						slashes = 0
						continue
					}
					else {
						if (symbol === "\\")
						{
							slashes++
						}
					}

					if (symbol === "/") {
						if (code[i - 1] !== "\\" || slashes === 0) {
							regexClosingIndex = i
							inRegex           = false
							slashes           = 0
							positions.push({
								type : "regex",
								position : [pos1, i]
							})

							i += 1 // because of the double symbol
						}
					}

					continue
				}
			}

			//-- checking strings ---------------------------------------------------------
			if (!inRegex && !inComment) {
				if (!inString) {
					if (symbol === '"' || symbol === "'" || symbol === "`") {
						inString   = true
						stringType = symbol
						pos1       = i
					}
				}
				else {
					if (isBracketDetected === false) {
						if (
							symbol === "(" || symbol === ")"
							|| symbol === "{" || symbol === "}"
							|| symbol === "[" || symbol === "]"
							|| symbol === "/"
							|| symbol === ";"
							|| symbol === ","
						) {
							isBracketDetected = true
						}
					}

					if (slashes > 0) {
						slashes = 0
						continue
					}
					else {
						if (symbol === "\\") {
							slashes++
						}
					}

					if (symbol === stringType) {
						if (i > 0) {
							if (
								(code[i - 1] !== "\\" || slashes === 0)
							) {
								inString = false
								slashes  = 0

								if (1 || isBracketDetected) {
									if (i - pos1 > 1)
									{
										positions.push({
											type     : "string-" + stringType,
											position : [pos1, i]
										})
									}
								}

								isBracketDetected = false
								stringType        = ""
							}
						}
					}
				}
			}
		}

		return positions
	}

	// replace stringies with timestamps, so they don't contain sensitive data
	stringiesEncode(code)
	{
		let positions  = this.stringies(code)
		let map        = {}
		let outputCode = ""

		if (positions.length > 0) {
			const grandWord = new Date().getTime()

			let posLast   = 0

			for (let i = 0; i < positions.length; i++) {
				const type          = positions[i].type
				const pos1          = positions[i].position[0]
				const pos2          = positions[i].position[1]
				const originalChunk = code.substring(pos1, pos2 + 1)

				let word = ""

				// TODO this functionality turned out to be very slow, so I removed it
				// for (let i in map) {
				// 	if (map[i].replacement === originalChunk) {
				// 		word = i
				//
				// 		break
				// 	}
				// }

				if (word === "") {
					let keyword = grandWord + i

					switch (type) {
						case "comment" :
							word = `//${keyword}`
							break
						case "comment-multiline" :
							word = `/*${keyword}*/`
							break
						case "string-'" :
							word = `'${keyword}'`
							break
						case "string-\"" :
							word = `"${keyword}"`
							break
						case "string-`" :
							word = `\`${keyword}\``
							break
						case "regex" :
							word = `/${keyword}/`
							break
					}

					map[word] = {occurrence : 0, replacement : originalChunk}
				}

				map[word].occurrence += 1

				outputCode += code.substring(posLast, pos1) + word

				posLast = pos2 + 1

				if (i === positions.length - 1) {
					outputCode += code.substr(pos2 + 1)
				}
			}
		}
		else {
			outputCode = code
		}

		return {
			positions : positions,
			map       : map,
			code      : outputCode
		}
	}

	/**
	 *
	 * @param code
	 * @param stringiesMap - Key-Value pairs where the key is the string to search for and the value is the replacement string. Keys MUST be sorted in the code and in the map, because this function starts from the beginning of the code and never looks back.
	 * @returns {string}
	 */
	stringiesDecode(code, stringiesMap)
	{
		//-- pass 1: replace everything that can be found multiple times in the code
		for (let keyword in stringiesMap)
		{
			if (stringiesMap.hasOwnProperty(keyword))
			{
				if (stringiesMap[keyword].occurrence !== 1)
				{
					code = code.split(keyword).join(stringiesMap[keyword]["replacement"])
				}
			}
		}

		//-- pass 2: replace everything that can be found only once using the fastest method
		let offset     = 0
		let pos        = 0
		let outputCode = ""

		for (let keyword in stringiesMap) {
			if (stringiesMap.hasOwnProperty(keyword)) {
				if (stringiesMap[keyword].occurrence !== 1) continue

				pos = code.indexOf(keyword, offset)

				if (pos > -1) {
					outputCode += code.substring(offset, pos) + stringiesMap[keyword].replacement

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
					outputCode = outputCode.replace(keyword, stringiesMap[keyword].replacement)
				}

				delete stringiesMap[keyword]
			}
		}

		outputCode += code.substr(offset)

		return outputCode
	}
}

module.exports = new SC()