/**
 * Synchronator is similar to Promise, and used along with JS Generators allows us to
 * write asynchronous JS with PHP-like fully synchronous syntax
 * @type {exports|module.exports}
 */

"use strict"

var $fs           = require("fs")
var $synchronator = require("./synchronator.js")
var $transform    = require("./transform.js")

var jscode = ""
$synchronator.getJavaScriptCode = function()
{
	if (!jscode)
	{
		jscode = $fs.readFileSync(__dirname + "/synchronator.js").toString("ascii")
	}

	return jscode
}

$synchronator.transform = $transform

module.exports = $synchronator