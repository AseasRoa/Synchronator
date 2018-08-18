const $path   = require("path")
const $fs     = require("fs")
const $vm     = require("vm")
const $synchronator = global.Synchronator || require("./synchronator.js")
const $util   = require("util")
const $module = require("./module")

/**
 * Read the input module file, convert it, run it and callback its "module.exports". A callback is needed, because
 * the whole module is wrapped into a Synchronator function and any code above (ot below) "module.exports"
 * should also look synchronous, but be asynchronously
 * @param filepath
 * @returns {*}
 */
function fileToModule(filepath, callback)
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
	var code = ""

	// do we really need to construct the code now, or we already have it in the cache?
	if ($synchronator.cache.isFileCached(filepath))
	{
		code = $synchronator.cache.getFileCachedVersion(filepath)
	}
	else
	{
		// 2) transform the file and get the output code
		code = $synchronator.transformModuleFile(filepath).code
	}

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

	var syncronator_function = fn(mod, mod.exports, requireEx.bind(global, dirname), filepath, dirname)

	// the idea of this function is to store each "mod" value for each iteration
	// otherwise because "then()" is asynchronous, "mod" gets overwtitten
	function runModule(syncronator_function, mod)
	{
		syncronator_function.then(() => {
			callback(filepath, mod.exports)
		})
	}

	// 4) return the exports
	runModule(syncronator_function, mod)
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
	var args    = arguments
	var folder  = arguments[0] // this parameter is provided via requireEx.bind() and is null when requireEx runs directly
	var path    = arguments[1] // this is the only parameter when we run the function directly

	var isFunctionCalledDirectly = (arguments[0] === null)

	var retval = new $synchronator((resolve) => {

		//== Shortcut for directly called modules. We use args[1] here, which is not normalized, to make things faster
		if (isFunctionCalledDirectly && args[1] in requireEx._cache)
		{
			resolve(requireEx._cache[args[1]])

			return
		}

		//== absolute address? -> explode it to pieces
		if ($path.isAbsolute(path))
		{
			folder = $path.dirname(path)
			path   = $path.basename(path)
		}

		//== try to find the module (or file) in the provided path
		var isLocalModule = false

		try {
			path = require.resolve(folder + $path.sep + path)

			isLocalModule = true
		}
		catch(error) {}

		//== nothing found, so now try to find the module (or file) in upper "node_modules" directory
		if (isLocalModule == false)
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
						isLocalModule = true
						break
					}
					else
					{
						resolve(require(path))

						return
					}
				}
				catch(error) {}
			}
		}

		//== still not found, discard the directory and try only with the path
		if (!isLocalModule)
		{
			try
			{
				let exp = require(path)

				resolve(exp)

				return
			}
			catch (error)
			{
				// TODO I don't remember why I have this here
				//resolve(require(args[1]))

				//return
			}
		}

		// if the module is in the cache, return it from there and exit
		if (requireEx._cache[path]) {
			resolve(requireEx._cache[path])

			return
		}

		// if the module is not in the cache, but is processing, wait for it to be loaded and then return it
		if (requireEx._processing[path] === true)
		{
			var interval = setInterval(() => {
				if (requireEx._processing[path] === false)
				{
					clearInterval(interval)
					resolve(requireEx._cache[path])
				}
			}, 0)

			return
		}

		requireEx._processing[path] = true

		watchForFileChanges(path)

		fileToModule(path, (path, exports) => {
			if (exports) requireEx._cache[path] = exports

			requireEx._processing[path] = false

			resolve(exports)
		})
	})

	if (isFunctionCalledDirectly)
	{
		return new $synchronator((resolve) => {
			retval.then((exports) => {

				// as this is directly called module and the input path is expected to be absolute one,
				// write it in the cache using the non-normalized version of the path,
				// to save some time when the same module is required again
				requireEx._cache[args[1]] = exports

				resolve(exports)
			})
		})
	}
	else
	{
		return retval
	}
}
requireEx._cache      = {}
requireEx._processing = {}

var watchForFileChanges = function(path)
{
	if (process.develop !== true) return

	if (watchForFileChanges.list[path]) return true

	var options = {
		persistent : true,
		recursive  : true
	}

	$fs.watch(path, options, (event, filename) => {

		if (filename.substr(-3) !== ".js") {return}

		// many events can come in no time, so we use timeout to make sure that we don't render too often
		if (watchForFileChanges.timeout)
		{
			clearTimeout(watchForFileChanges.timeout)
			watchForFileChanges.timeout = null
		}

		watchForFileChanges.timeout = setTimeout(() => {

			if (filename === "script" || filename === "public" || filename === "stylesheet") {return} // skip for some subfolders

			requireEx._cache = {}

			//console.info("Reloading modules because of file change in \"" + path + "\"")
		}, 0)

	})

	watchForFileChanges.list[path] = true
}
watchForFileChanges.list    = {}
watchForFileChanges.timeout = 0

module.exports = requireEx