class ClassName
{
	publicProperty   = null
	#privateProperty = null
	#privateArray    = []

	constructor(argument)
	{
		this.publicProperty   = argument
		this.#privateProperty = argument
		this.#privateArray[0] = argument
	}

	getPrivateProperty()
	{
		return this.#privateProperty
	}

	giveMeResultAfterTimeout(arg)
	{
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(arg)
			}, 1)
		})
	}

	method1()
	{
		return this.method2()
	}

	* method2()
	{
		this.#privateProperty = this.#privateArray[0]
		this.publicProperty   = this.#privateProperty

		return this.giveMeResultAfterTimeout(this.publicProperty)
	}
}

module.exports = ClassName