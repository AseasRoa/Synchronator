const testsPath = `${__dirname}/testScripts`

describe("Synchronator Test:", () => {
	beforeAll(() => {
		require("../")
	})

	it("Is Synchronator global variable present?", () => {
		expect(Synchronator).not.toEqual(undefined)
		expect(typeof Synchronator.require).toEqual("function")
	})

	it("Delete Cache", () => {
		let result = Synchronator.cache.deleteAll()

		expect(result).toEqual(true)
	})

	it("require empty module", (done) => {
		let module = Synchronator.require(`${testsPath}/testEmptyModule.js`)

		expect(module).toBeInstanceOf(Synchronator)
		expect(typeof module.then).toEqual("function")

		module.then((exports) => {
			// the native require function returns an empty Object, this one should too
			expect(exports).toBeInstanceOf(Object)
			expect(Object.keys(exports).length).toEqual(0)

			done()
		})
	})

	it("testFunctions", (done) => {
		let module = Synchronator.require(`${testsPath}/testFunctions.js`)

		module.then((exports) => {
			expect(exports).toBeInstanceOf(Array)

			for (let i in exports)
			{
				expect(exports[i]).toEqual("result")
			}

			done()
		})
	})

	it("testFunctions2", (done) => {
		let module = Synchronator.require(`${testsPath}/testFunctions2.js`)

		module.then((exports) => {
			expect(exports).toBeInstanceOf(Array)

			for (let i in exports)
			{
				if (exports.hasOwnProperty(i))
				{
					expect(exports[i]).toEqual("result")
				}
			}

			done()
		})
	})

	it("testClass", (done) => {
		let module = Synchronator.require(`${testsPath}/testClass.js`)

		module.then((exports) => {
			// is it a class?
			expect(typeof exports.constructor).toEqual("function")

			let instance = new exports("result")

			expect(instance.property).toEqual("result")

			instance.method1().then((result) => {
				expect(result).toEqual("result")
				done()
			})
		})
	})

	it("testClassProperties", (done) => {

		let module = Synchronator.require(`${testsPath}/testClassProperties.js`)

		module.then((exports) => {
			// is it a class?
			expect(typeof exports.constructor).toEqual("function")

			let instance = new exports("result")

			//expect(instance.publicProperty).toEqual("result")
			expect(instance.getPrivateProperty()).toEqual("result")

			instance.method1().then((result) => {
				expect(result).toEqual("result")
				done()
			})
		})
	})

	it("testChaining", (done) => {

		let module = Synchronator.require(`${testsPath}/testChaining.js`)

		module.then((exports) => {
			// is it a class?
			expect(typeof exports.constructor).toEqual("function")

			let instance = new exports("result")

			instance.method1().then((result) => {
				expect(result).toEqual("result")
				done()
			})
		})
	})
})