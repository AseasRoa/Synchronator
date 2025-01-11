let giveMeResultAfterTimeout = function (arg) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(arg)
		}, 1)
	})
}

class ClassName
{
	publicArray   = [{function : null}]
	#privateArray = [{function : null}]
	#privateValue = 0

	constructor()
	{
		this.publicArray[0].function = function (arg) {
			return arg
		}

		this.#privateArray[0].function = function (arg) {
			return arg
		}
	}

	giveMeResultAfterTimeout(arg)
	{
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(arg)
			}, 1)
		})
	}

	* method1()
	{
		let arr   = [[""]]
		let value = arr[this.#privateValue][0]

		return this.giveMeResultAfterTimeout(
			this.publicArray[0].function("r")
			+ this.publicArray[0]["function"]("e")
			+ this.publicArray[0]['function']('s')
			+ this.#privateArray[0].function("u")
			+ this.#privateArray[0]["function"]("l")
			+ this.#privateArray[0]['function']("t")
			+ value
		)
	}
}

module.exports = ClassName