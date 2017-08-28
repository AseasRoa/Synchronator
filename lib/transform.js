/**
 * Function to transform JavaScript code into Synchronator-ready code
 * @type {exports|module.exports}
 */

"use strict"

const $fs   = require("fs")
const $os   = require('os')
const $path = require("path")
const $sourceCode = require("./sourceCode.js")

/**
 * Create directory (synchronously)
 * @param path {string} The directory path that must be created
 * @returns {boolean} true if the directory exists or it was created, false if error happened
 */
function mkdirs(path)
{
	path = $path.resolve(path)

	var sep     = $path.sep
	var dirs    = path.split(sep)
	var prevDir = dirs.splice(0, 1) + sep

	while (dirs.length > 0)
	{
		var curDir = prevDir + dirs.splice(0, 1)

		if (!$fs.existsSync(curDir))
		{
			try {
				$fs.mkdirSync(curDir)
			}
			catch (e)
			{
				return false
			}
		}
		prevDir = curDir + sep
	}

	return true
}

const path_cache = $os.tmpdir() + $path.sep + "nodejs-synchronator"

if (!mkdirs(path_cache)) path_cache = null

/**
 * Add "yield" keywords before all function calls in the code. This will NOT add "yield" keywords for chained functions.
 * Something like fn() becomes (yield fn())
 * Something like fn().fn() becomes (yield fn().fn())
 * @param code
 * @returns {string}
 */
function addInitialYields(code)
{
	//== put yields at most places

	var reserved  = ['else if', 'yield', 'async', 'await', 'function', 'class', 'if', 'for', 'while', 'return', 'break', 'continue', 'switch', 'do', 'delete', 'false', 'true', 'try', 'catch']

	var pattern = /(?:([\w]+) )?([\w\$\.]*(?:[\w]+))([\(\[])([\s\S]+)/

	var match = code.match(pattern)

	if (match)
	{
		var codepos1 = match.index
		var codepos2 = codepos1+match[0].length

		var foreword    = match[1] // "yield" in "yield fcall()"
		var fcall       = match[2] // "fcall" in "yield fcall()"
		var openbracket = match[3]
		var rest        = match[4] // everything after the (

		// when we have something like this obj['fname'].fn2() we should detect [
		var closebracket = ")"
		if (openbracket === "[") {
			closebracket = "]"
		}

		var retval

		var idx  = $sourceCode.findClosingBracket(rest, closebracket, 1, 0)
		var args = rest.substr(0, idx) // everything inside the brackets
		var rest = rest.substr(idx + 1) // the rest of the code, all after the closing bracket

		// if we detected [ and we don't have . after ], like this "obj['key'] = 123", then revert
		if (openbracket === "[" && rest.trim()[0] !== ".") {

			rest = addInitialYields(rest)

			foreword = (foreword) ? foreword + " " : ""

			retval = foreword + fcall + openbracket + args + closebracket + rest
		}
		else {
			args = addInitialYields(args)
			rest = addInitialYields(rest)

			if (foreword === "return")
			{
				retval = "return (yield " + fcall + openbracket + args + closebracket + ")" + rest
			}

			else if (
					(fcall[0] == '.') //-- chaining like .fcall().fcall()
					||
					(reserved.indexOf(foreword) > -1) //-- the foreword is something like yield or await
					||
					(reserved.indexOf(fcall) > -1) //-- the function name is a reserved word
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
	code = code.replace(/([^\r\n\;\,\.\:\+\-\*\/\=\{\[\<\>])([\r\n]+\s*)(\(yield )/g, '$1$2;$3')


	// if ; is placed at the end of a comment, then try to add another ; before the comment
	/*
	 code
	 // fn();
	 (yield fn())
	 */

	// remove ; if ; is after : if (condition)
	code = code.replace(/([^\+\-\*\/\=\w]if\s*\([^\n]*\))([\r\n]\s*)\;(\(yield )/g, '$1$2$3')

	return code
}

/**
 * Add "yield" keywords for the chained functions all around the input code
 * Something like (yield fn().fn()) becomes (yield (yield fn()).fn())
 * @param code
 * @returns {string}
 */
function addChainedYields(code)
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
			var idx         = $sourceCode.findClosingBracket(rest, ')', yieldscount)
			var chain       = rest.substr(0, idx) // all before the nth closing bracket
			var afteryields = rest.substr(idx+1)  // all after the nth closing bracket

			if (afteryields[0] === '.')
			{
				// from "fn(args)everything else" get "fn" and "args)everythingelse"
				var match = afteryields.match(/^\.([\w]+(?:[\w]?)(?:\[.*?\])?)\(([\s\S]+)/)

				// match[1] - the function's name
				// match[2] - all after the fname(

				if (match)
				{
					var idx1 = $sourceCode.findClosingBracket(match[2], ')')

					matched = true

					return "(yield "
						+ yieldcode
						+ chain + ")"
						+ '.' + match[1]
						+ "(" + match[2].substr(0, idx1+1) + ")"
						+ match[2].substr(idx1+1)
				}
				else {
					// there are no function in the chain
					//-- something like: (yield Object.keys(obj)).length

					return yieldcode + addChainedYields(rest)
				}
			}
			else {
				return yieldcode + addChainedYields(rest)
			}
		})

		if (matched === false) break
	}

	return code
}

/**
 * Removes "yield" keywords in a code
 * @param code
 * @returns {string}
 */
function removeYieldKeywords(code)
{
	// remove "(yield %some code%)"

	var regex = /\(yield ([\s\S]*)/

	while(true)
	{
		var matched = false

		code = code.replace(regex, function(all, rest) {

			var idx   = $sourceCode.findClosingBracket(rest, ')')

			matched = true

			return rest.substr(0, idx) + rest.substr(idx+1)
		})

		if (matched === false) break
	}

	// remove "yield "
	code = code.replace(/([^\w])yield /, "$1")

	return code
}

/**
 * If "yield" keywords were added to inappropriate locations, this function removes them
 * @param code
 * @returns {*}
 */
function removeUnnecesarryYields(code)
{
	// remove yields like this: function * (yield name()) {...
	var regex = /(function\s*\*?\s*)\(yield ([\s\S]+)/g
	code = code.replace(regex, function(all, head, rest)
	{
		var idx   = $sourceCode.findClosingBracket(rest, ')')
		return head + rest.substr(0, idx) + rest.substr(idx+1)
	})

	if (0)
	{
		// remove yield keywords from non-generator functions
		var regexes = [
			/(\s*function(?:\s+[A-Za-z0-9_$]+)?\s*\([^\(\)\{\}]*\)\s*\{)([\S\s]*)/g,
			/(\([^\(\)\{\}]*\)\s*\=\>\s*\{)([\S\s]*)/g
		]

		for (var r in regexes)
		{
			var regex = regexes[r]

			code = code.replace(regex, function (all, head, rest)
			{
				var idx   = $sourceCode.findClosingBracket(rest, '}')
				var fbody = rest.substr(0, idx + 1)
				var rest1 = rest.substr(idx + 1)

				rest1 = removeUnnecesarryYields(rest1)

				return head + removeYieldKeywords(fbody) + rest1
			})
		}
	}

	return code
}

/**
 * Add "yield" keywords in the input code
 * @param code
 * @returns {string}
 */
function addYields(code)
{
	code = addInitialYields(code)

	code = addChainedYields(code)

	code = removeUnnecesarryYields(code)

	return code
}

function makeNormalFunctionsMap(code)
{
	var output = {}

	var grandword = new Date().getTime()

	var patterns = [
		/\s*function(?:\s+[A-Za-z0-9_$]+)?\s*\([^\(\)\{\}]*\)\s*\{/g,
		/\([^\(\)\{\}]*\)\s*\=\>\s*\{/g
	]

	for (var p in patterns)
	{
		var match
		var offset = 0
		var codetmp = ""

		while (match = patterns[p].exec(code))
		{
			if (match.index < offset) {continue} // because "g" actually matches inside brackets

			var open_pos  = match.index + match[0].length
			var close_pos = $sourceCode.findClosingBracket(code, '}', 1, open_pos)

			var keyword = parseInt(grandword + open_pos)

			codetmp += code.substring(offset, match.index) + keyword

			output[keyword] = code.substring(match.index, close_pos+1)

			offset = close_pos + 1
		}

		codetmp += code.substr(offset)
		code = codetmp
		codetmp = ""
	}

	// The output object must be sorted by keys. This is because later the function which has to decode each element
	// starts from the beginning of the code and never returns back. Both, the elements in the code and the keys in the map
	// must be sorted.
	// The elements are placed with "open_pos" in mind, so in the code they are sorted well. But the map that we have now could be sorted or not.
	var keys = [],
	  k, i, len;

	for (k in output) {
	  if (output.hasOwnProperty(k)) {
	    keys.push(k);
	  }
	}

	keys.sort();

	len = keys.length;

	var output_sorted = {}
	for (i = 0; i < len; i++) {
	  k = keys[i];
		output_sorted[k] = output[k]
	}

	return {
		map  : output_sorted,
		code : code
	}
}

function addSynchronatorCode(code, weirdKeyword)
{
	// Notice: I removed the "async" patterns from below, because "async" already exists as a native keyword
	var patterns = [
		/(^|[^\w])function\s*\*\s*([A-Za-z0-9_$]+)?\s*\(([^\(\)\{\}]*)\)(\s*)(?=\{)/g,    // function * fname() | function * ()
		///(^|[^\w])async\s+function(\s+[A-Za-z0-9_$]+)?\s*\(([^\(\)\{\}]*)\)(\s*(?=\{))/g, // var foo = async function(arg) {
		///(^|[^\w])async\s+(\s+[A-Za-z0-9_$]+)?\s*\(?([^\{\}\;\:]+?)\)?\s*=>(\s*(?=\{))/g, // async (arg) => {
	]

	for (var p in patterns)
	{
		var pattern = patterns[p]

		var offset = 0
		var match = null
		var codetmp = null

		while (match = pattern.exec(code))
		{
			if (match.index < offset) {continue} // because "g" actually matches inside brackets

			//var beforerest  = match[0] // the whole part before rest, this is needed to count the index of rest
			var frontsymbol = match[1] // anything before function*(, it could be (
			var fname       = match[2] || "" // the name of the function in case of: function *fname()
			var args        = match[3]
			var emptystr    = match[4]

			//openbrace += "{" // compensation because of the positive lookahead that is used in the regex (?=\{)

			var open_pos  = match.index + match[0].length
			//open_pos++ // compensation because of the positive lookahead that is used in the regex (?=\{)
			var close_pos = 0

			//== add ); after the closing }
			var cnt = 0 // how many { were found and need to be matched with }. When } is found and this is 0, this is our }

			for (var i=open_pos+1; i<code.length; i++)
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

			// function's body
			var body = code.substring(open_pos+1, close_pos)

			// only add yields if no "yield" keyword is used in the code
			var matchYields = body.match(/[^\w](yield |await )/)
			if (matchYields == null)
			{
				body = addYields(body)
			}

			body = addSynchronatorCode(body, weirdKeyword)

			if (fname) {
				if (fname[0] !== " ") fname = " " + fname
				fname = "var" + fname + " = "
			}

			if (codetmp === null) {codetmp = ""}

			codetmp +=
					code.substring(offset, match.index)
					+ fname
					+ frontsymbol
					+ weirdKeyword
					+ args
					+ ")"
					+ emptystr
					+ "{"
					+ body
					+ "})"

			offset = close_pos + 1
		}

		if (codetmp !== null) {
			codetmp += code.substr(offset)
			code = codetmp
			codetmp = null
		}
	}

	return code
}

/**
 * Transforms the JS code written in Synchronator style into JS code that can be processed by the Synchronator
 * @param code {string} The input code
 * @param file {string} Optional. Unique file name that will be used for cache
 * @returns {object} The transformed code
 */
var transform = function(code, file)
{

	var cache_filename = null
	var code_read_from_cache = false

	if (path_cache && file)
	{
		var file = $path.resolve(file)
		var sep = $path.sep

		cache_filename = path_cache + sep + file.replace(new RegExp(sep.replace("\\", "\\\\"), 'g'), "-").replace(/:/g, "-")

		var stat_original_file = false
		var stat = false
		var exist = false

		try {
			stat = $fs.statSync(cache_filename)
			exist = stat.isFile()

			stat_original_file = $fs.statSync(file)
		}
		catch (error) {}

		// get the code from the cache file
		if (exist)
		{
			if (stat_original_file.mtime < stat.mtime)
			{
				try {
					code = $fs.readFileSync(cache_filename, "utf8")
					code_read_from_cache
				}
				catch (error) {
					console.error(error)
				}
			}
		}
	}

	if (code_read_from_cache === false)
	{
		var syncronatorPrepend         = 'Synchronator.runGenerator(function*('
		var synchronatorPrependPattern = 'Synchronator\\.runGenerator\\(function\\*\\('
		var weirdKeyword               = 'dy43nyyrhn4d9y49ire98n8h8h' // to prevent endless loop if the value of syncronatorPrepend code already exists

		code = code.replace(new RegExp(synchronatorPrependPattern, 'g'), weirdKeyword)

		var stringiesResult = $sourceCode.stringiesEncode(code)

		//var stringiesPos = stringiesResult['positions']
		var stringiesMap = stringiesResult['stringies']
		code             = stringiesResult['code']

		var functionsMapResult = makeNormalFunctionsMap(code)
		var functionsMap       = functionsMapResult["map"]
		code                   = functionsMapResult["code"]

		code = addSynchronatorCode(code, weirdKeyword)

		code = $sourceCode.stringiesDecode(code, functionsMap)

		code = code.replace(new RegExp(weirdKeyword, 'g'), syncronatorPrepend)

		// rename "await" to "yield"
		code = code.replace(/([^A-Za-z_$.])await([\s]+)([\S])/g, "$1yield$2$3")

		//return the static stuff to its places
		code = $sourceCode.stringiesDecode(code, stringiesMap)

		// write to the cache file
		if (cache_filename)
		{
			$fs.writeFileSync(cache_filename, code)
		}
	}

	return {
		code      : code,
		sourceMap : null, // TODO add sourceMap capability
		cacheDir  : path_cache,
		file      : file
	}
}

module.exports = transform