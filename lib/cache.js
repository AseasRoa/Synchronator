/**
 * This is a set of functions responsible for caching the transformed files
 * into the temporary folder of the OS
 *
 * @type {exports|module.exports}
 */

const $fs   = require("fs")
const $os   = require("os")
const $path = require("path")

/**
 * Create directory (synchronously)
 * @param path {string} The directory path that must be created
 * @returns {boolean} true if the directory exists or it was created, false if error happened
 */
function createDirectorySync(path = "")
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
			catch (e) {
				return false
			}
		}
		prevDir = curDir + sep
	}

	return true
}

let pathCache = $os.tmpdir() + $path.sep + "nodejs-synchronator"

if (!createDirectorySync(pathCache)) pathCache = null

var getPath = function()
{
	return pathCache
}

var isFileCached = function(file)
{
	var file = $path.resolve(file)
	var sep  = $path.sep

	var cacheFileName = pathCache + sep + file.replace(new RegExp(sep.replace("\\", "\\\\"), "g"), "-").replace(/:/g, "-")

	var originalFileStat = {}
	var cacheFileStat    = {}
	var cacheFileExists  = false
	var cached           = false

	try {
		cacheFileStat    = $fs.statSync(cacheFileName)
		cacheFileExists  = cacheFileStat.isFile()
		originalFileStat = $fs.statSync(file)
	} catch (error) {
	}

	if (cacheFileExists)
	{
		if (originalFileStat.mtime < cacheFileStat.mtime)
		{
			cached = true
		}
	}

	return cached
}

var getFileCachedVersion = function(file)
{
	if (!isFileCached(file))
	{
		return new Error("The file is not cached")
	}

	var file = $path.resolve(file)
	var sep  = $path.sep

	var cacheFileName = pathCache + sep + file.replace(new RegExp(sep.replace("\\", "\\\\"), "g"), "-").replace(/:/g, "-")

	try {
		code = $fs.readFileSync(cacheFileName, "utf8")
	}
	catch (error) {
		return error
	}

	return code
}

var writeFileCachedVersion = function(file, code)
{
	var file = $path.resolve(file)
	var sep  = $path.sep

	var cacheFileName = pathCache + sep + file.replace(new RegExp(sep.replace("\\", "\\\\"), "g"), "-").replace(/:/g, "-")

	$fs.writeFileSync(cacheFileName, code)
}

var deleteAll = function()
{
	let path = getPath()

	try
	{
		let files = $fs.readdirSync(path)

		for (let i in files)
		{
			let filePath = path + $path.sep + files[i]

			$fs.unlinkSync(filePath)
		}

		return true
	}
	catch (e)
	{
		return true
	}

	return false
}

module.exports = {
	getPath,
	isFileCached,
	getFileCachedVersion,
	writeFileCachedVersion,
	deleteAll
}