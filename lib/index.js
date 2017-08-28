"use strict"

const $fs           = require("fs")
const $synchronator = require("./synchronator.js")
const $transform    = require("./transform.js")
const $require      = require("./require.js")

global.Synchronator = $synchronator

/**
 * Make an export method who can get the JS code that can be used in a browser
 * @type {string}
 */
let jscode = "" // simple cache
$synchronator.getJavaScriptCode = function()
{
	if (!jscode)
	{
		jscode = $fs.readFileSync(__dirname + "/synchronator.js").toString("ascii")
	}

	return jscode
}

/**
 * Make an export method who can transform JS code written in Synchronator style into regular JS code
 * @type {object}
 */
$synchronator.transform = $transform

$synchronator.require = $require.bind(null, null)

module.exports = $synchronator