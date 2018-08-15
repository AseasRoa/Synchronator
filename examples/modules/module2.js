// Hey buddy, how are you? - this is an example text that will be read and returned

/*
	This module shows us:
	- that we can write synchronous code with asynchronous functions even in the global space of the module
 */

var fs = require("fs")

// Although "fs.readFile" is a callback function, we can wait for it.
// Just put that (0) mark as a last argument.
var thisFileContents = fs.readFile(__filename, "utf8", (0))

function * runModule()
{
	// Take a look at the first comment on the top of this file.
	// The file was read and now this text will be substracted and returned

	return thisFileContents.substr(3, 23)
}

// let's export the function here
module.exports = runModule