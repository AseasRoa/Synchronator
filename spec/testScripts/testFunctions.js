function fn1(arg1 = "res", arg2 = "ult")
{
	return arg1 + arg2
}

function * fn2(arg1 = "res", arg2 = "ult")
{
	return arg1 + arg2
}

var fn3 = function (arg1 = "res", arg2 = "ult") {
	return arg1 + arg2
}

var fn4 = function * (arg1 = "res", arg2 = "ult") {
	return arg1 + arg2
}

const fn5 = (arg1 = "res", arg2 = "ult") => {
	return arg1 + arg2
}

let fn6 = (arg1 = "res", arg2 = "ult") => arg1 + arg2

module.exports = [
	fn1(),
	fn2(),
	fn3(),
	fn4(),
	fn5(),
	fn6()
]