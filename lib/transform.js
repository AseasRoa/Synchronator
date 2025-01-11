/**
 * Function to transform JavaScript code into Synchronator-ready code
 * @type {exports|module.exports}
 */

"use strict"

const $sourceCode = require("./sourceCode.js")
const $cache      = require("./cache")
const $path       = require("path")
const $fs         = require("fs")

/**
 * Add "yield" keywords before all function calls in the code. This will NOT add "yield" keywords for chained functions.
 * Something like fn() becomes (yield fn())
 * Something like fn().fn() becomes (yield fn().fn())
 * @param {string} code
 * @param {string} yieldKeyword - yield or await
 * @returns {string}
 */
function addInitialYields(code = "", yieldKeyword = "yield")
{
	//== add initial "yield" keywords in the code
	const reserved = [
		"class", "*",
		"yield", "async", "await",
		"if", "else if", "for", "while", "switch", "do",
		"return", "break", "continue",
		"function", "delete", "false", "true", "try", "catch",
		"console.assert", "console.clear", "console.count", "console.error",
		"console.group", "console.groupCollapsed", "console.groupEnd", "console.info",
		"console.log", "console.table", "console.time", "console.timeEnd", "console.trace", "console.warn"
	]

	let match = code.match(/(?:([\w]+) )?([\w$#.]*(?:[\w]+))([(\[])([\s\S]+)/)

	if (match)
	{
		let foreword       = match[1] // "yield" in "yield functionName()"
		let functionName   = match[2] // "functionName" in "yield functionName()"
		let openingBracket = match[3] // the opening bracket
		let theRest        = match[4] // everything after the (

		if (functionName === ".then")
		{
			return code
		}
		// when we have something like this obj["fname"].fn2() we should detect [
		let closingBracket = ")"

		if (openingBracket === "[")
		{
			closingBracket = "]"
		}

		let output = ""

		let idx               = $sourceCode.findClosingBracket(theRest, closingBracket, 1, 0)
		let functionArguments = theRest.substr(0, idx)  // everything inside the brackets
		theRest               = theRest.substr(idx + 1) // the rest of the code, all after the closing bracket

		// if we detected [ and we don't have . after ], like this "obj["key"] = 123", then revert
		if (
			(openingBracket === "[")
			&& (theRest.trim()[0] !== ".")
		)
		{
			theRest = addInitialYields(theRest, yieldKeyword)

			foreword = (foreword) ? foreword + " " : ""

			output = `${foreword}${functionName}${openingBracket}${functionArguments}${closingBracket}${theRest}`
		}
		else
		{
			functionArguments = addInitialYields(functionArguments, yieldKeyword)
			theRest           = addInitialYields(theRest, yieldKeyword)

			let dotNotationDetected = (functionName[0] === ".")

			if (dotNotationDetected === false)
			{
				let args_match = functionArguments.match(/(^|(?:.*),\s*)\([0-9.]+\)($|,\s*(?:.*))/)

				if (args_match)
				{
					let front_args = args_match[1] || ""
					let back_args  = args_match[2] || ""

					functionName      = "Synchronator.CallbackCatcher(function(){" + ((functionName[0] === ".") ? "this" : "") + functionName + "(" + front_args + "arguments[0]" + back_args + ")})"
					functionArguments = ""
					openingBracket    = ""
					closingBracket    = ""
				}
			}

			if (foreword === "return")
			{
				output = `return (${yieldKeyword} ${functionName}${openingBracket}${functionArguments}${closingBracket})${theRest}`
			}
			else if (
				// chaining like .functionName().functionName()
				(dotNotationDetected)
				// the foreword is something like yield or await
				|| (reserved.indexOf(foreword) > -1)
				// the function name is a reserved word
				|| (reserved.indexOf(functionName) > -1)
			)
			{
				foreword = (foreword) ? foreword + " " : ""

				output = `${foreword}${functionName}${openingBracket}${functionArguments}${closingBracket}${theRest}`
			}
			else
			{
				foreword = (foreword) ? foreword + " " : ""

				output = `(${yieldKeyword} ${foreword}${functionName}${openingBracket}${functionArguments}${closingBracket})${theRest}`
			}
		}

		code = code.substring(0, match.index) + output + code.substring(match.index + output.length)
	}

	/*
	 fix this situation:
	 code
	 (yield fn())
	 by adding ; before "(yield"
	 */
	if (yieldKeyword === "await")
	{
		code = code.replace(/([^\r\n;,.:+\-*\/=({\[<>])([\r\n]+\s*)(\(await )/g, "$1$2;$3")
	}
	else
	{
		code = code.replace(/([^\r\n;,.:+\-*\/=({\[<>])([\r\n]+\s*)(\(yield )/g, "$1$2;$3")
	}

	// if ; is placed at the end of a comment, then try to add another ; before the comment
	/*
	 code
	 // fn();
	 (yield fn())
	 */

	// remove ; if ; is after : if (condition)
	if (yieldKeyword === "await")
	{
		code = code.replace(/([^+\-*\/=\w]if\s*\([^\n]*\))([\r\n]\s*);(\(await )/g, "$1$2$3")
	}
	else
	{
		code = code.replace(/([^+\-*\/=\w]if\s*\([^\n]*\))([\r\n]\s*);(\(yield )/g, "$1$2$3")
	}

	return code
}

/**
 * Add "yield" keywords for the chained functions all around the input code
 * Something like (yield fn().fn()) becomes (yield (yield fn()).fn())
 * @param {string} code
 * @param {string} yieldKeyword - yield or await
 * @returns {string}
 */
function addChainedYields(code = "", yieldKeyword = "yield")
{
	let regex1 = new RegExp(`((?:\\(${yieldKeyword} )+)([\\s\\S]*)`)
	//let regex2 = /((?:\(yield )+)([\s\S]*)/

	while (true)
	{
		let matched = false

		code = code.replace(regex1, function (all, yieldCode, theRest) {
			// yieldCode - the chain of yields -> (yield | (yield (yield
			// theRest - everything that follows

			let yieldscount = yieldCode.length / `(${yieldKeyword} `.length // how many "(yield " in a row
			let idx         = $sourceCode.findClosingBracket(theRest, ")", yieldscount)
			let chain       = theRest.substr(0, idx)  // all before the closing bracket of (yield fn())
			let afteryields = theRest.substr(idx + 1) // all after the closing bracket of (yield fn())

			if (afteryields[0] === ".")
			{
				// from "fn(args)everythingelse" get "fn" and "args)everythingelse"
				let match = afteryields.match(/^\.([\w]+(?:[\w]?)(?:\[.*?])?)\(([\s\S]+)/)

				// [1] - the name of the function
				// [2] - all after the fname(

				if (match)
				{
					let idx1    = $sourceCode.findClosingBracket(match[2], ")")
					let args    = match[2].substr(0, idx1)
					let theRest = match[2].substr(idx1 + 1)

					let args_match = args.match(/(.*),\s*\([0-9.]+\)\s*$/)

					matched = true

					if (args_match)
					{
						return `(${yieldKeyword} ${yieldCode}${chain}).SynchronatorCallbackCatcher(function(){this.${match[1]}(${args_match[1]},arguments[0])}))${theRest}`
					}
					else
					{
						return `(${yieldKeyword} ${yieldCode}${chain}).${match[1]}(${args}))${theRest}`
					}
				}
				else
				{
					// there is no function in the chain
					// something like: (yield Object.keys(obj)).length

					return yieldCode + addChainedYields(theRest)
				}
			}
			else
			{
				return yieldCode + addChainedYields(theRest)
			}
		})

		if (matched === false) break
	}

	return code
}

/**
 * If "yield" keywords were added to inappropriate locations, this function removes them
 * @param {string} code
 * @param {string} yieldKeyword - yield or await
 * @returns {string}
 */
function removeUnnecesarryYields(code = "", yieldKeyword = "yield")
{
	// remove yields like this: function * (yield name()) {...
	let pattern = new RegExp(`(function\\s*\\*?\\s*)\\(${yieldKeyword} ([\\s\\S]+)`, "g")
	//let pattern2 = /(function\s*\*?\s*)\(yield ([\s\S]+)/g

	code = code.replace(pattern, function (all, head, theRest) {
		let idx = $sourceCode.findClosingBracket(theRest, ")")
		return head + theRest.substr(0, idx) + theRest.substr(idx + 1)
	})

	return code
}

/**
 * Add "yield" keywords in the input code
 * @param {string} code
 * @param {string} yieldKeyword - yield or await
 * @returns {string}
 */
function addYields(code = "", yieldKeyword = "yield")
{
	code = addInitialYields(code, yieldKeyword)
	code = addChainedYields(code, yieldKeyword)
	code = removeUnnecesarryYields(code, yieldKeyword)

	return code
}

/**
 * Classes need to be processed separatedly from the old-fashioned JavaScript code for few reasons:
 * - Their Generator-like methods are collected (their names) and additional code is added after the class definition.
 * - The method names (when Generator) are not modified, they remain as a normal Generator methods.
 * - The class is an asynchronous structure and when it is located inside other Genertor function, problems could happen.
 * @param {string} code
 * @param {string} weirdKeyword
 * @param {object} stringiesMap
 * @param {object} classesMap
 * @returns {string}
 */
function extractClassesFromSourceCode(code = "", weirdKeyword = "", stringiesMap, classesMap)
{
	let replacementKeyword = "_c_l_a_s_s_"

	if (!(classesMap instanceof Object)) classesMap = {}

	let patterns = [
		// Examples: Animal = class SomeClass{ | Animal = class{. Here "Animal" is the name of the class.
		// The class name should also be able to be module.exports ot module["exports"]
		/(?<!\w)(([a-zA-Z_$][\w$.\[\]'"]*)\s*=\s*class(?:\s+[a-zA-Z_$][\w_$]*)?\s*){([\s\S]+)/,

		// Examples: class Animal{
		/(?<!\w)(class\s+([a-zA-Z_$][\w_$]*)?\s*(?:extends\s+(?:[a-zA-Z_$][\w_$]*))?\s*){([\s\S]+)/
	]

	for (let p in patterns)
	{
		let pattern = patterns[p]

		while (true)
		{
			let match = pattern.exec(code)

			if (match === null)
			{
				break
			}

			let until_bracket = match[1]
			let class_name    = match[2]
			let theRest       = match[3]

			let close_pos = $sourceCode.findClosingBracket(theRest, "}")
			let keyword   = replacementKeyword + "_" + Object.keys(classesMap).length

			classesMap[keyword] = {
				name                 : class_name,
				head                 : "",
				body                 : "",
				generatorMethodsList : {}
			}

			// maybe the closing bracket was not found? (close_pos would be the last position)
			if (close_pos === -1)
			{
				try
				{
					throw new Error("Could not find closing bracket near code:\n" + until_bracket + "{" + theRest.substr(0, 20))
					break
				} catch (e)
				{
					console.error(e.message)
					break
				}
			}

			let codeBeforeClass = code.substr(0, match.index)

			let codeClassHead = code.substr(match.index, match[1].length)
			let codeClassBody = code.substr(match.index + match[1].length, close_pos + 2)
			codeClassBody     = addSynchronatorCode(codeClassBody, weirdKeyword, stringiesMap, classesMap[keyword])

			let codeAfterClass = code.substr(match.index + match[1].length + close_pos + 2)

			classesMap[keyword]["head"] = codeClassHead
			classesMap[keyword]["body"] = codeClassBody

			code = codeBeforeClass + keyword + codeAfterClass
		}
	}

	return code
}

/**
 *
 * @param {string} code
 * @param {string} weirdKeyword
 * @param {object} stringiesMap
 * @param {object} classesMap
 * @returns {string}
 */
function importClassesBackInTheSourceCode(code = "", weirdKeyword = "", stringiesMap, classesMap)
{
	if (Object.keys(classesMap).length > 0)
	{
		let quotes = ['"', "'", "`"]

		for (let keyword in classesMap)
		{
			let classCode            = classesMap[keyword]["head"] + classesMap[keyword]["body"]
			let className            = classesMap[keyword]["name"]
			let generatorMethodsList = classesMap[keyword]["generatorMethodsList"]

			for (let methodName in generatorMethodsList)
			{
				if (generatorMethodsList.hasOwnProperty(methodName))
				{
					// if methods were written in this way: * "method-name"() {
					if (
						stringiesMap
						&& quotes.indexOf(methodName[0]) > -1
						&& quotes.indexOf(methodName[methodName.length - 1]) > -1
					)
					{
						methodName = stringiesMap[methodName]["replacement"]
						methodName = methodName.substr(1, methodName.length - 2)
					}

					classCode += `;${className}.prototype["${methodName}"] = Synchronator.runGenerator(${className}.prototype["${methodName}"]);`
				}
			}

			code = code.replace(keyword, classCode)
		}
	}

	return code
}

/**
 * The strings and comments sections of the input code MUST be clean - previously replaced with keywords.
 * If not, the regular expressions could fail.
 * @param {string} code
 * @returns {{map: {}, code: string}}
 */
function makeNormalFunctionsMap(code = "")
{
	let output = {}

	let grandWord     = new Date().getTime()
	let not_functions = ["if", "for", "while", "switch", "class", "try", "catch"]

	let patterns = [
		// 1) regular functions pattern. Note that sometimes a function name could be "something_function" (with quotes)
		/(?<!async )(?<!\w)(\s*function(\s+[A-Za-z_$][\w$]*)?\s*\([^();]*\)[\s\/*0-9]*){/g,
		// 2) arrow functions pattern
		/(?<!async )(?<!\w)(\([^();]*\)\s*=>\s*){/g,
		// 3) methods in class
		/(?<=[^*\w$\s]|\n)(\s*([A-Za-z_$][\w$]*)\s*\([^();]*\)\s*){/g
	]

	for (let p in patterns)
	{
		let offset  = 0
		let tmpCode = ""

		while (true)
		{
			let match = patterns[p].exec(code)

			if (match === null)
			{
				break
			}

			// [0] - the whole match
			// [1] - everything after [1] until the closing {
			// [2] - the function name
			if (match[2] && not_functions.indexOf(match[2]) > -1)
			{
				continue
			}

			if (match.index < offset - 1)
			{
				continue
			} // because "g" actually matches inside brackets

			// the position of the opening {
			let open_pos  = match.index + match[1].length
			// the position of the closing }
			let close_pos = $sourceCode.findClosingBracket(code, "}", 1, open_pos + 1)
			// the replacement string
			let keyword   = `_fn_${parseInt(grandWord + open_pos)}_`

			// reached end of file, probably the function has no closing bracket
			if (close_pos === -1) close_pos = code.length

			tmpCode += code.substring(offset, match.index) + keyword
			output[keyword] = code.substring(match.index, close_pos + 1)
			offset          = close_pos + 1
		}

		tmpCode += code.substr(offset) // the 1 here is because of the closing }
		code    = tmpCode
		tmpCode = ""
	}

	// The output object must be sorted by keys. This is because later the function which has to decode each element
	// starts from the beginning of the code and never returns back. Both, the elements in the code and the keys in the map
	// must be sorted.
	// The elements are placed with "open_pos" in mind, so in the code they are sorted well. But the map that we have now could be sorted or not.
	let keys = []

	for (let key in output)
	{
		if (output.hasOwnProperty(key))
		{
			keys.push(key)
		}
	}

	keys.sort()

	let length = keys.length

	let output_sorted = {}

	for (let i = 0; i < length; i++)
	{
		let key = keys[i]

		output_sorted[key] = {occurrence : 1, replacement : output[key]}
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
	code           = extractClassesFromSourceCode(code, weirdKeyword, stringiesMap, classesMap)

	// 2) Now find all Generator-style functions, change them to Synchronator-style functions and add "yield" keywords in their bodies
	let patterns = []

	if (currentClassMap)
	{
		// This pattern is not always added, but when it is, it should be the first pattern
		// * fname(args) {
		patterns.push(/(?<frontSymbol>^|[^\w])(?<functionKeyword>)(?<type>\*)\s*(?<functionName>[A-Za-z0-9_$\[\]'"`]+)\s*\((?<functionArguments>[^();]*)\)(?<emptyString>[\s\/*0-9]*)(?={)/g)
		patterns.push(/(?<frontSymbol>^|[^\w])(?<type>async)\s+(?<functionName>[A-Za-z0-9_$\[\]'"`]+)\s*\((?<functionArguments>[^();]*)\)(?<emptyString>[\s\/*0-9]*)(?={)/g)
	}

	// function * fname(args) | function * (args) {
	patterns.push(/(?<frontSymbol>^|[^\w])(?<functionKeyword>function)\s*(?<type>\*)\s*(?<functionName>[A-Za-z0-9_$]+)?\s*\((?<functionArguments>[^();]*)\)(?<emptyString>[\s\/*0-9]*)(?={)/g)
	patterns.push(/(?<frontSymbol>^|[^\w])(?<type>async)\s+(?<functionKeyword>function)\s*(?<functionName>[A-Za-z0-9_$]+)?\s*\((?<functionArguments>[^();]*)\)(?<emptyString>[\s\/*0-9]*)(?={)/g)
	patterns.push(/(?<frontSymbol>^|[^\w])(?<type>async)\s+(?<functionKeyword>)(?<functionName>)(\((?<functionArguments>[^();]*)\))(?<emptyString>\s*=>\s*)(?={)/g)

	// Note: Each function is first transformed and then put into a temporary map object. In the code we put keywords.
	// After the collection of all functions, they are put back into the code.
	let functionsCollector                   = {}
	let functionsCollectorReplacementKeyword = "_f_c_r_k_"

	// Find out all the matches, but still do nothing with them
	let matches = []

	for (let p in patterns)
	{
		if (patterns.hasOwnProperty(p))
		{
			let pattern = patterns[p]

			while (true)
			{
				let match = pattern.exec(code)

				if (match === null)
				{
					break
				}

				matches.push({index : match.index, match : match})
			}
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

		let type              = match.groups["type"]
		let frontSymbol       = match.groups["frontSymbol"]           // anything before function*(, it could be (
		let functionKeyword   = match.groups["functionKeyword"] || "" // "function" or an empty string
		let functionName      = match.groups["functionName"] || ""    // the name of the function in case of: function *fname()
		let functionArguments = match.groups["functionArguments"]     // the arguments list of the function
		let emptyString       = match.groups["emptyString"]           // any space symbols before {, or it could contain jsDoc comment

		let open_pos  = match.index + match[0].length // the position of the opening {
		let close_pos = -1                            // will be the position of the closing }

		// find the position of the closing }
		let cnt = 0 // how many { were found and need to be matched with }. When } is found and this is 0, this is our }

		for (let i = open_pos + 1; i < code.length; i++)
		{
			if (code[i] === "{")
			{
				cnt++
			}
			else if (code[i] === "}")
			{
				if (cnt === 0)
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
			console.error("Closing bracket } is missing for function " + functionName)
			close_pos = code.length - 1
		}

		// extract the body of the function
		let body = code.substring(open_pos + 1, close_pos)

		let wholeFunction = ""
		let matchYields   = (type === "*") ? body.match(/[^\w](yield )/) : body.match(/[^\w](await )/)

		if (matchYields === null)
		{
			body = addYields(body, (type === "*") ? "yield" : "await")
		}

		if (currentClassMap && functionName /* about functionName: in class method we can have fn(argument, function*() {}) and in this case we don't want o tread that callback function as a class method */)
		{
			// We land here when we want to detect methods in a class.
			wholeFunction = ""
				//+ frontSymbol
				+ ((type === "async") ? "async " : "")
				+ (functionKeyword || "")
				+ ((type === "*") ? "* " : "")
				+ functionName
				+ "(" + functionArguments + ")"
				+ emptyString
				+ "{" + body + "}"

			if (type === "*") currentClassMap["generatorMethodsList"][functionName] = functionName
		}
		else
		{
			if (type === "async")
			{
				wholeFunction = ""
					+ "async " + (functionKeyword ? functionKeyword : "")
					+ (functionName ? " " + functionName : "")
					+ "(" + functionArguments + ")"
					+ emptyString
					+ "{" + body + "}"
			}
			else
			{
				// We land here when we are outside of a class
				if (functionName)
				{
					if (functionName[0] !== " ") functionName = " " + functionName
					functionName = "var" + functionName + " = "
				}
				if (0)
				{
					wholeFunction = ""
						+ "async "
						+ functionName
						//+ weirdKeyword
						+ "(" + functionArguments + ")"
						+ emptyString
						+ "{" + body + "}"
				}
				else
				{
					wholeFunction = ""
						+ functionName
						+ weirdKeyword
						+ functionArguments + ")"
						+ emptyString
						+ "{" + body + "})"
				}
			}
		}

		let key                 = functionsCollectorReplacementKeyword + (Object.keys(functionsCollector).length + 1)
		functionsCollector[key] = wholeFunction
		wholeFunction           = key

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
 * @param {string} code
 * @returns {{map: {}, code: string}}
 */
let dotNotationEncode = function (code = "") {
	let map = {}
	let cnt = 0

	// Examples:
	// varname["key"]
	// varname[i]
	let pattern = /\[["'`]?([\w$#.]+)["'`]?]/g

	code = code.replace(pattern, function (all) {
		// the counter number should be between two other symbols to prevent replacing wrong keywords
		// for example we may search for keyword_1 and we would find it in keyword_11
		let replacement = `._d_o_t_${cnt++}_`

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
 * @param {string} code
 * @param {object} map
 * @returns {string}
 */
let dotNotationDecode = function (code = "", map = {}) {
	for (let key in map)
	{
		code = code.replace(new RegExp(key, "g"), map[key])
	}

	return code
}

/**
 * Transforms the JS code written in Synchronator style into JS code that can be processed by the Synchronator
 * @param code {string} The input code
 * @returns {{code: string}} The transformed code
 */
let transform = function (code = "") {
	let syncronatorPrepend         = "Synchronator.runGenerator(function*("
	let synchronatorPrependPattern = syncronatorPrepend.replace(/([^\w])/g, "\\$1")
	let weirdKeyword               = "(_s_y_n_c_r_o_n_a_t_o_r_" // to prevent endless loop if the value of syncronatorPrepend code already exists

	code = code.replace(new RegExp(synchronatorPrependPattern, "g"), weirdKeyword)

	let stringiesResult = $sourceCode.stringiesEncode(code)
	let stringiesMap    = stringiesResult["map"]
	code                = stringiesResult["code"]

	let functionsMapResult = makeNormalFunctionsMap(code)
	let functionsMap       = functionsMapResult["map"]
	code                   = functionsMapResult["code"]

	let dotNotationResult = dotNotationEncode(code)
	let dotNotationMap    = dotNotationResult["map"]
	code                  = dotNotationResult["code"]

	code = addSynchronatorCode(code, weirdKeyword, stringiesMap)

	code = dotNotationDecode(code, dotNotationMap)

	code = $sourceCode.stringiesDecode(code, functionsMap)

	code = code.replace(new RegExp(weirdKeyword.replace(/([^\w])/g, "\\$1"), "g"), syncronatorPrepend)

	//return the static stuff to its places
	code = $sourceCode.stringiesDecode(code, stringiesMap)

	return {
		code : code
	}
}

/**
 * Transform file
 * @param {string} inputFile
 * @returns {{code : string, cacheDir : string, file : string}}
 */
let transformModuleFile = function (inputFile = "") {
	let code_read_from_cache = false // flag that says whether the code was read from cache
	let code                 = ""

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
		let file_found = false

		try
		{
			code       = $fs.readFileSync(inputFile, "ascii")
			file_found = true
		} catch (error)
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