const $module = require("./module")
const $path   = require("path")
const $fs     = require("fs")
const $vm     = require("vm")
const $synchronator = global.Synchronator || require("./synchronator.js")
const $util   = require("util")

/**
 * Read the file, process it as a Synchronator module and return its "module.exports"
 * @param filepath
 * @returns {*}
 */
function fileToModule(filepath)
{
	if (0)
	{
		var sandbox = {
			global       : global,
			console      : console,
			Synchronator : $synchronator,
			setTimeout   : setTimeout,
			clearTimeout : clearTimeout,
			clearInterval: clearInterval,
			setInterval  : setInterval,
			setImmediate : setImmediate,
		}
	}

	// 1) read the file and add some additional stuff to it
	var code = $fs.readFileSync(filepath, "ascii")
	code     = code + "\r\n"
	code     = "(function*(module, exports, require, __filename, __dirname) {\"use strict\";\r\n" + code + "});"

	// 2) transform the file and get the output code
	code     = $synchronator.transform(code, filepath).code

	// 3) evaluate the transformed code
	//var fn = $vm.runInNewContext(code, sandbox, {
	var fn = $vm.runInThisContext(code, {
		filename     : filepath,
		lineOffset   : -1,
		displayErrors: true,
		columnOffset : 0
	})

	// 3) create a module
	var dirname = $path.dirname(filepath)

	var mod = new $module(filepath)
	mod.filename = filepath

	var syncronator_function = fn(mod, mod.exports, requireEx.bind(null, dirname), filepath, dirname)

	syncronator_function.then((value) => {})

	// 4) return the exports
	return mod.exports
}

/**
 * Try to find "package.json" for the provided module and return true if "synchronator" value is found there
 * @param dirname
 * @returns {boolean}
 */
function isModuleSynchronatorReady(dirname)
{
	var is_module_synchronator_ready = false

	// try to find "package.json" and get "synchronator" value from it
	try
	{
		var package_json = $fs.readFileSync(dirname + $path.sep + "package.json")

		if (package_json)
		{
			try {
				package_json = JSON.parse(package_json)
				is_module_synchronator_ready = (!!package_json["synchronator"])
			} catch (e) {}
		}

	}
	catch (error) {
		// nothing here, because we are really only trying to see if "package.json" exists
	}

	return is_module_synchronator_ready
}

/**
 * Alternative function to be used instead of "require()" in Synchronator-ready modules
 * @returns {*}
 */
function requireEx()
{
	//== read the input arguments
	var folder  = arguments[0] // this parameter is provided via requireEx.bind()
	var path    = arguments[1] // this is the only parameter when we run the function directly

	//== absolute address? -> explode it to pieces
	if ($path.isAbsolute(path))
	{
		folder = $path.dirname(path)
		path   = $path.basename(path)
	}

	//== try to find the module (or file) in the provided path
	var resolved = false

	try {
		path = require.resolve(folder + $path.sep + path)

		resolved = true // becomes true if the path can be resolved
	}
	catch(error) {}

	//== nothing found, so now try to find the module (or file) in upper "node_modules" directory
	if (resolved == false)
	{
		var tmpPath = $path.resolve(folder)

		// try to find the module in some "node_modules" in the current or upper level
		while (true)
		{
			var current_dir = $path.dirname(tmpPath)
			if (current_dir === tmpPath) {break}
			tmpPath = current_dir

			try {
				var tryPath = tmpPath + $path.sep + "node_modules" + $path.sep + arguments[1]
				var is_module_synchronator_ready = false

				path = require.resolve(tryPath)

				if (isModuleSynchronatorReady(tryPath))
				{
					resolved = true
					break
				}
				else
				{
					return require(path)
				}
			}
			catch(error) {}
		}
	}

	//== still not found, discard the directory and try only with the path
	if (!resolved)
	{
		try
		{
			path = require.resolve(path)
		}
		catch (error)
		{
			return require(arguments[1])
		}
	}

	// if the module is in the cache, return it from there and exit
	if (requireEx._cache[path]) {
		return requireEx._cache[path]
	}

	var exports = fileToModule(path)

	if (exports) requireEx._cache[path] = exports

	return exports
}
requireEx._cache = {}

module.exports = requireEx