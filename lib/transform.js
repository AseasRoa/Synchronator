/**
 * Function to transform JavaScript code into Synchronator-ready code
 * @type {exports|module.exports}
 */

"use strict"
const $sourceCode = require("./sourceCode.js")
const $cache = require("./cache")
const $path  = require("path")
const $fs    = require("fs")

/**
 * Add "yield" keywords before all function calls in the code. This will NOT add "yield" keywords for chained functions.
 * Something like fn() becomes (yield fn())
 * Something like fn().fn() becomes (yield fn().fn())
 * @param code
 * @returns {string}
 */
function addInitialYields(code = "")
{
	//== add initial "yield" keywords in the code
	var reserved  = [
		"class", "*",
		"yield", "async", "await",
		"if", "else if", "for", "while", "switch", "do",
		"return", "break", "continue",
		"function", "delete", "false", "true", "try", "catch"
	]

	var pattern = /(?:([\w]+) )?([\w\$\.]*(?:[\w]+))([\(\[])([\s\S]+)/

	var match = code.match(pattern)

	if (match)
	{
		var codepos1 = match.index
		var codepos2 = codepos1+match[0].length

		var foreword    = match[1] // "yield" in "yield fcall()"
		var fcall       = match[2] // "fcall" in "yield fcall()"
		var openbracket = match[3] // the opening bracket
		var rest        = match[4] // everything after the (

		// when we have something like this obj["fname"].fn2() we should detect [
		var closebracket = ")"

		if (openbracket === "[") {
			closebracket = "]"
		}

		var retval = ""

		var idx  = $sourceCode.findClosingBracket(rest, closebracket, 1, 0)
		var args = rest.substr(0, idx)  // everything inside the brackets
		var rest = rest.substr(idx + 1) // the rest of the code, all after the closing bracket

		// if we detected [ and we don't have . after ], like this "obj["key"] = 123", then revert
		if (openbracket === "[" && rest.trim()[0] !== ".")
		{
			rest = addInitialYields(rest)

			foreword = (foreword) ? foreword + " " : ""

			retval = foreword + fcall + openbracket + args + closebracket + rest
		}

		else
		{
			args = addInitialYields(args)
			rest = addInitialYields(rest)

			let dotNotationDetected = (fcall[0] === ".")

			if (dotNotationDetected == false)
			{
				let args_match = args.match(/(^|(?:.*),\s*)\([0-9.]+\)($|,\s*(?:.*))/)

				if (args_match)
				{
					let front_args = args_match[1] || ""
					let back_args  = args_match[2] || ""

					fcall        = "Synchronator.CallbackCatcher(function(){" + ((fcall[0] === ".") ? "this" : "") + fcall + "(" + front_args + "arguments[0]" + back_args + ")})"
					args         = ""
					openbracket  = ""
					closebracket = ""
				}
			}

			if (foreword === "return")
			{
				retval = "return (yield " + fcall + openbracket + args + closebracket + ")" + rest
			}
			else if (
					   (dotNotationDetected)             // chaining like .fcall().fcall()
					|| (reserved.indexOf(foreword) > -1) // the foreword is something like yield or await
					|| (reserved.indexOf(fcall) > -1)    // the function name is a reserved word
			)
			{
				foreword = (foreword) ? foreword + " " : ""

				retval = foreword + fcall + openbracket + args + closebracket + rest

			}
			else
			{
				foreword = (foreword) ? foreword + " " : ""

				retval = "(yield " + foreword + fcall + openbracket + args + closebracket + ")" + rest
			}
		}

		code = code.substring(0, match.index) + retval + code.substring(match.index + retval.length)
	}


	/*
	 fix this situation:
	 code
	 (yield fn())
	 by adding ; before "(yield"
	 */
	code = code.replace(/([^\r\n\;\,\.\:\+\-\*\/\=\{\[\<\>])([\r\n]+\s*)(\(yield )/g, "$1$2;$3")


	// if ; is placed at the end of a comment, then try to add another ; before the comment
	/*
	 code
	 // fn();
	 (yield fn())
	 */

	// remove ; if ; is after : if (condition)
	code = code.replace(/([^\+\-\*\/\=\w]if\s*\([^\n]*\))([\r\n]\s*)\;(\(yield )/g, "$1$2$3")

	return code
}

/**
 * Add "yield" keywords for the chained functions all around the input code
 * Something like (yield fn().fn()) becomes (yield (yield fn()).fn())
 * @param code
 * @returns {string}
 */
function addChainedYields(code = "")
{
	var regex1 = /((?:\(yield )+)([\s\S]*)/

	while (true)
	{
		var matched = false

		code = code.replace(regex1, function(all, yieldcode, rest)
		{
			// yieldcode - the chain of yields -> (yield | (yield (yield
			// rest - everything that follows

			var yieldscount = yieldcode.length / "(yield ".length // how many "(yield " in a row
			var idx         = $sourceCode.findClosingBracket(rest, ")", yieldscount)
			var chain       = rest.substr(0, idx)  // all before the closing bracket of (yield fn())
			var afteryields = rest.substr(idx + 1) // all after the closing bracket of (yield fn())

			if (afteryields[0] === ".")
			{
				// from "fn(args)everythingelse" get "fn" and "args)everythingelse"
				var match = afteryields.match(/^\.([\w]+(?:[\w]?)(?:\[.*?\])?)\(([\s\S]+)/)

				// [1] - the name of the function
				// [2] - all after the fname(

				if (match)
				{
					var idx1 = $sourceCode.findClosingBracket(match[2], ")")
					var args = match[2].substr(0, idx1)
					var rest = match[2].substr(idx1 + 1)

					let args_match = args.match(/(.*),\s*\([0-9.]+\)\s*$/)

					matched = true

					if (args_match)
					{
						return "(yield " + yieldcode + chain + ")" + ".SynchronatorCallbackCatcher(function(){this." + match[1] + "(" + args_match[1] + ",arguments[0])})" + ")" + rest
					}
					else
					{
						return "(yield " + yieldcode + chain + ")" + "." + match[1] + "(" + args + ")" + ")" + rest
					}
				}
				else {
					// there are no function in the chain
					// something like: (yield Object.keys(obj)).length

					return yieldcode + addChainedYields(rest)
				}
			}
			else
			{
				return yieldcode + addChainedYields(rest)
			}
		})

		if (matched === false) break
	}

	return code
}

/**
 * If "yield" keywords were added to inappropriate locations, this function removes them
 * @param code
 * @returns {*}
 */
function removeUnnecesarryYields(code = "")
{
	// remove yields like this: function * (yield name()) {...
	var pattern = /(function\s*\*?\s*)\(yield ([\s\S]+)/g

	code = code.replace(pattern, function(all, head, rest)
	{
		var idx   = $sourceCode.findClosingBracket(rest, ")")
		return head + rest.substr(0, idx) + rest.substr(idx+1)
	})

	return code
}

/**
 * Add "yield" keywords in the input code
 * @param code
 * @returns {string}
 */
function addYields(code = "")
{
	code = addInitialYields(code)

	code = addChainedYields(code)

	code = removeUnnecesarryYields(code)

	return code
}

/**
 * Classes need to be processed separatedly from the old-fashioned JavaScript code for few reasons:
 * - Their Generator-like methods are collected (their names) and additional code is added after the class definition.
 * - The method names (when Generator) are not modified, they remain as a normal Generator methods.
 * - The class is an asynchronous structure and when it is located inside other Genertor function, problems could happen.
 * @param code
 * @param weirdKeyword
 * @param stringiesMap
 * @param classesMap
 * @returns {{}}
 */
function extractClassesFromSourceCode(code = "", weirdKeyword = "", stringiesMap, classesMap)
{
	let match              = null
	let replacementKeyword = "_c_l_a_s_s_"

	if  (!(classesMap instanceof Object)) classesMap = {}

	let patterns = [
		// Examples: Animal = class SomeClass{ | Animal = class{. Here "Animal" is the name of the class.
		// The class name should also be able to be module.exports ot module["exports"]
		/(?<!\w)(([a-zA-Z_$][\w\$\.\[\]\'\"]*)\s*=\s*class(?:\s+[a-zA-Z_$][\w_$]*)?\s*)\{([\s\S]+)/,

		// Examples: class Animal{
		/(?<!\w)(class\s+([a-zA-Z_$][\w_$]*)?\s*(?:extends\s+(?:[a-zA-Z_$][\w_$]*))?\s*)\{([\s\S]+)/
	]

	for (let p in patterns)
	{
		let pattern = patterns[p]

		while (match = pattern.exec(code))
		{
			let until_bracket = match[1]
			let class_name    = match[2]
			let rest          = match[3]

			let close_pos = $sourceCode.findClosingBracket(rest, "}")
			let keyword   = replacementKeyword + "_" + Object.keys(classesMap).length

			classesMap[keyword] = {
				name : class_name,
				head : "",
				body : "",
				generatorMethodsList : {}
			}

			// maybe the closing bracket was not found? (close_pos would be the last position)
			if (close_pos === -1)
			{
				try {
					throw new Error("Could not find closing bracket near code:\n" + until_bracket + "{" + rest.substr(0, 20))
					break
				}
				catch(e) {
					console.error(e.message)
					break
				}
			}

			let codeBeforeClass = code.substr(0, match.index)

			let codeClassHead = code.substr(match.index, match[1].length)
			let codeClassBody = code.substr(match.index + match[1].length, close_pos + 2)
			codeClassBody = addSynchronatorCode(codeClassBody, weirdKeyword, stringiesMap, classesMap[keyword])

			let codeAfterClass = code.substr(match.index + match[1].length + close_pos + 2)

			classesMap[keyword]["head"] = codeClassHead
			classesMap[keyword]["body"] = codeClassBody

			code = codeBeforeClass + keyword + codeAfterClass
		}
	}

	return code
}

function importClassesBackInTheSourceCode(code = "", weirdKeyword = "", stringiesMap, classesMap)
{
	if (Object.keys(classesMap).length > 0)
	{
		let quotes = ['"', "'", "`"]

		for (let keyword in classesMap)
		{
			let classCode = classesMap[keyword]["head"] + classesMap[keyword]["body"]
			let className = classesMap[keyword]["name"]

			for (let method_name in classesMap[keyword]["generatorMethodsList"])
			{
				// if methods were written in this way: * "method-name"() {
				if (
						   stringiesMap
						&& quotes.indexOf(method_name[0]) > -1
						&& quotes.indexOf(method_name[method_name.length - 1]) > -1
				)
				{
					method_name = stringiesMap[method_name]["replacement"]
					method_name = method_name.substr(1, method_name.length - 2)
				}

				classCode += ";" + className + ".prototype[\"" + method_name + "\"] = Synchronator.runGenerator(" + className + ".prototype[\"" + method_name + "\"]);"
			}

			code = code.replace(keyword, classCode)
		}
	}

	return code
}

/**
 * The strings and comments sections of the input code MUST be clean - previously replaced with keywords.
 * If not, the regular expressions could fail.
 * @param code
 * @returns {{map: {}, code: *}}
 */
function makeNormalFunctionsMap(code = "")
{
	let output = {}

	let grandword = new Date().getTime()
	let not_functions = ["if", "for", "while", "switch", "class", "try", "catch"]

	let patterns = [
		/(?<!\w)(\s*function(\s+[A-Za-z_$][\w$]*)?\s*\([^\(\){};]*\)\s*){/g, // 1) regular functions pattern. Note that sometimes a function name could be "something_function"
		/(?<!\w)(\([^\(\){};]*\)\s*=>\s*){/g,                                // 2) arrow functions pattern
		/(?<=[^\*\w\$\s]|\n)(\s*([A-Za-z_$][\w$]*)\s*\([^\(\){};]*\)\s*){/g  // 3) methods in class
	]

	for (let p in patterns)
	{
		let match   = null
		let offset  = 0
		let codetmp = ""

		while (match = patterns[p].exec(code))
		{
			// [0] - the whole match
			// [1] - everything after [1] until the closing {
			// [2] - the function name

			if (match[2] && not_functions.indexOf(match[2]) > -1) {continue}

			if (match.index < offset - 1) {continue} // because "g" actually matches inside brackets

			let open_pos  = match.index + match[1].length // the position of the opening {
			let close_pos = $sourceCode.findClosingBracket(code, "}", 1, open_pos + 1)            // the position of the closing }
			let keyword   = "_fn" + parseInt(grandword + open_pos) + "_"                                        // the replacement string

			// reached end of file, probably the function has no closing bracket
			if (close_pos == -1) close_pos = code.length

			codetmp         += code.substring(offset, match.index) + keyword
			output[keyword] = code.substring(match.index, close_pos + 1)
			offset          = close_pos + 1
		}

		codetmp += code.substr(offset) // the 1 here is because of the closing }
		code    = codetmp
		codetmp = ""
	}

	// The output object must be sorted by keys. This is because later the function which has to decode each element
	// starts from the beginning of the code and never returns back. Both, the elements in the code and the keys in the map
	// must be sorted.
	// The elements are placed with "open_pos" in mind, so in the code they are sorted well. But the map that we have now could be sorted or not.
	let keys = [];

	for (let key in output)
	{
	  if (output.hasOwnProperty(key))
	  {
	    keys.push(key);
	  }
	}

	keys.sort();

	let length = keys.length;

	var output_sorted = {}

	for (let i = 0; i < length; i++)
	{
		let key = keys[i]

		output_sorted[key] = {occurence: 1, replacement: output[key]}
	}

	return {
		map  : output_sorted,
		code : code
	}
}

/**
 * Finds all generator-style functions and converts them into Synchronator-style functions.
 * @param code            - The input code. Should be cleared from normal functions
 * @param weirdKeyword    - A string that replaces the part of the function names that contains the word Synchronator. This is to prevent the function to be processed more than once.
 * @param stringiesMap    - used when having classes with methods written like this: * "method-name"() {
 * @param currentClassMap - Classes are processed in a different way and their method names are collected. This has 2 roles - to indicate that the code is a class body and to return those class methods as a reference.
 * @returns {*}
 */
function addSynchronatorCode(code = "", weirdKeyword = "", stringiesMap, currentClassMap)
{
	// 1) First of all, extract classes and process them sepatedly
	let classesMap = {}
	code = extractClassesFromSourceCode(code, weirdKeyword, stringiesMap, classesMap)

	// 2) Now find all Generator-style functions, change them to Synchronator-style functions and add "yield" keywords in their bodies
	let patterns = []

	if (currentClassMap)
	{
		// This pattern is not always added, but when it is, it should be the first pattern
		// * fname(args) {
		patterns.push(/(^|[^\w])\*\s*([A-Za-z0-9_$\[\]'"`]+)\s*\(([^\(\){};]*)\)(\s*)(?={)/g)
	}

	// function * fname(args) | function * (args) {
	patterns.push(/(^|[^\w])function\s*\*\s*([A-Za-z0-9_$]+)?\s*\(([^\(\){}]*)\)(\s*)(?={)/g)

	// Note: I removed the "async" patterns from below, because "async" already exists as a native keyword
	//patterns.push(/(^|[^\w])async\s+function(\s+[A-Za-z0-9_$]+)?\s*\(([^\(\)\{\}]*)\)(\s*(?=\{))/g) // var foo = async function(arg) {
	//patterns.push(/(^|[^\w])async\s+(\s+[A-Za-z0-9_$]+)?\s*\(?([^\{\}\;\:]+?)\)?\s*=>(\s*(?=\{))/g) // async (arg) => {

	// Note: Each function is first transformed and then put into a temporary map object. In the code we put keywords.
	// After the collection of all functions, they are put back into the code.
	let functionsCollector = {}
	let functionsCollectorReplacementKeyword = "_f_c_r_k_"

	// Find out all the matches, but still do nothing with them
	let matches = []

	for (let p in patterns)
	{
		let pattern = patterns[p]

		let offset  = 0
		let match   = null
		let codetmp = null

		while (match = pattern.exec(code))
		{
			matches.push({index: match.index, match: match})
		}
	}

	// Sort matches by index. It's needed after 2 or more patterns were used.
	matches.sort(function (a, b) {
		return a.index - b.index
	})

	// Process all matches, starting from the last one.
	// This is because for every function that is found, we don't want another functions in it.
	// This is how functions containing manually written "yield" keywords can be skipped.
	for (let i = matches.length - 1; i >= 0; i--)
	{
		let match = matches[i].match

		let frontsymbol = match[1]       // anything before function*(, it could be (
		let fname       = match[2] || "" // the name of the function in case of: function *fname()
		let args        = match[3]       // the arguments list of the function
		let emptystr    = match[4]       // any space symbols before {

		let open_pos  = match.index + match[0].length // the position of the opening {
		let close_pos = -1                            // will be the position of the closing }

		// find the position of the closing }
		let cnt = 0 // how many { were found and need to be matched with }. When } is found and this is 0, this is our }

		for (let i = open_pos + 1; i < code.length; i++)
		{
			if (code[i] == "{")
			{
				cnt++
			}
			else if (code[i] == "}")
			{
				if (cnt == 0)
				{
					close_pos = i
					break
				}
				else
				{
					cnt--
				}
			}
		}

		// wait, no closing position was found?
		if (close_pos === -1)
		{
			console.error("Closing bracket } is missing for function " + fname)
			close_pos = code.length - 1
		}

		// extract the body of the function
		var body = code.substring(open_pos + 1, close_pos)

		var wholeFunction = ""
		var matchYields   = body.match(/[^\w](yield |await )/)

		if (matchYields === null)
		{
			body = addYields(body)
		}

		if (currentClassMap)
		{
			// We land here when we want to detect methods in a class.
			wholeFunction = ""
				//+ frontsymbol
				+ "* "
				+ fname
				+ "(" + args + ")"
				+ emptystr
				+ "{" + body + "}"

			currentClassMap["generatorMethodsList"][fname] = fname
		}
		else
		{
			// We land here when we are outside of a class
			if (fname)
			{
				if (fname[0] !== " ") fname = " " + fname
				fname = "var" + fname + " = "
			}

			wholeFunction = ""
				+ fname
				+ weirdKeyword
				+ args + ")"
				+ emptystr
				+ "{" + body + "})"
		}

		let key = functionsCollectorReplacementKeyword + (Object.keys(functionsCollector).length + 1)
		functionsCollector[key] = wholeFunction
		wholeFunction = key

		code = code.substr(0, match.index + match[1].length) + wholeFunction + code.substr(close_pos + 1)
	}

	// Put back all functions from the temporary object into the code, starting from the last element in the object.
	let keys   = Object.keys(functionsCollector)
	let length = keys.length

	for (let i = length; i >= 0; i--)
	{
		let keyword = keys[i]

		code = code.replace(keyword, functionsCollector[keyword])

		delete functionsCollector[keyword]
	}

	// 3) Place the removed classes back into the code
	code = importClassesBackInTheSourceCode(code, weirdKeyword, stringiesMap, classesMap)

	// Return the transformed code
	return code
}

/**
 * Find all ["123456"] and transform them into dot notation
 * The input code is expected to contain safe strings and comments
 * @param code
 * @returns {{map: {}, code: string}}
 */
var dotNotationEncode = function(code = "")
{
	let map = {}
	let cnt = 0
	// Examples:
	// varname["key"]
	// varname[i]
	let pattern = /\[["'`]?([\w$.]+)["'`]?\]/g

	code = code.replace(pattern, function(all, m1) {
		// the counter number should be between two other symbols to prevent replacing wrong keywords
		// for example we may search for keyword_1 and we would find it in keyword_11
		let replacement = "._d_o_t_" + cnt++ + "_"

		map[replacement] = all

		return replacement
	})

	return {
		map  : map,
		code : code
	}
}

/**
 * The opposite of dotNotationEncode()
 * @param code
 * @param map
 * @returns {*}
 */
var dotNotationDecode = function(code = "", map = {})
{
	for (let key in map)
	{
		code = code.replace(new RegExp(key, "g"), map[key])
	}

	return code
}

/**
 * Transforms the JS code written in Synchronator style into JS code that can be processed by the Synchronator
 * @param code {string} The input code
 * @param file {string} Optional. Unique file name that will be used for cache
 * @returns {object} The transformed code
 */
var transform = function(code = "")
{
	var syncronatorPrepend         = "Synchronator.runGenerator(function*("
	var synchronatorPrependPattern = syncronatorPrepend.replace(/([^\w])/g, "\\$1")
	var weirdKeyword               = "(_s_y_n_c_r_o_n_a_t_o_r_" // to prevent endless loop if the value of syncronatorPrepend code already exists

	code = code.replace(new RegExp(synchronatorPrependPattern, "g"), weirdKeyword)

	var stringiesResult = $sourceCode.stringiesEncode(code)
	var stringiesMap    = stringiesResult["map"]
	code                = stringiesResult["code"]

	var functionsMapResult = makeNormalFunctionsMap(code)
	var functionsMap       = functionsMapResult["map"]
	code                   = functionsMapResult["code"]

	var dotNotationResult = dotNotationEncode(code)
	var dotNotationMap    = dotNotationResult["map"]
	code                  = dotNotationResult["code"]

	code = addSynchronatorCode(code, weirdKeyword, stringiesMap)

	code = dotNotationDecode(code, dotNotationMap)

	code = $sourceCode.stringiesDecode(code, functionsMap)

	code = code.replace(new RegExp(weirdKeyword.replace(/([^\w])/g, "\\$1"), "g"), syncronatorPrepend)

	// rename "await" to "yield"
	code = code.replace(/([^A-Za-z_$.])await([\s]+)([\S])/g, "$1yield$2$3")

	//return the static stuff to its places
	code = $sourceCode.stringiesDecode(code, stringiesMap)

	return {
		code : code
	}
}

var transformModuleFile = function(inputFile = "")
{
	var code_read_from_cache = false // flag that says whether the code was read from cache
	var code = ""

	inputFile = $path.resolve(inputFile)

	// If the file was already transformed, read it from the file
	if ($cache.getPath() && inputFile)
	{
		if ($cache.isFileCached(inputFile))
		{
			code = $cache.getFileCachedVersion(inputFile)

			if (!(code instanceof Error))
			{
				code_read_from_cache = true
			}
		}
	}

	if (code_read_from_cache === false)
	{
		var file_found = false

		try
		{
			code = $fs.readFileSync(inputFile, "ascii")
			file_found = true
		}
		catch (error)
		{
			console.error(error)
		}

		if (file_found)
		{
			// wrap the file contents into a module Generator-type function
			code = ";(function*(module, exports, require, __filename, __dirname) {\"use strict\";\r\n" + code + "});"

			// transform the code
			code = transform(code).code

			// write to the cache file
			$cache.writeFileCachedVersion(inputFile, code)
		}
	}

	return {
		code     : code,
		//sourceMap : null, // TODO add sourceMap capability
		cacheDir : $cache.getPath(),
		file     : inputFile
	}
}

module.exports = {
	transform           : transform,
	transformModuleFile : transformModuleFile
}

// some regexes that I could use:
// \((?:[^\{\}]+?)?\) - to use it in function calls to detect situations like this fn1(fn2(), fn3())