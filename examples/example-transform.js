//==================================================================//
//== This example shows how Synchronator transforms the input code ==/
//==================================================================//

var Synchronator = require("synchronator")

var code = `
var fn1 = function*(time)
{
    var result = sleep(time)

    return result
})

var fn2 = function*()
{
    var result = fn1(1000)

    return result
})`

var transformed_code = Synchronator.transform(code)

// "transformed_code" is now an object and we can find the code in .code

console.log(transformed_code.code)