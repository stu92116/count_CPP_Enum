build:
	npm run build

package: build
	vsce package
