const { session } = require("electron");

const filter = {
	urls: [
		"https://*"
	],
};

session
	.defaultSession
	.webRequest
	.onBeforeSendHeaders(filter, proxyRequestHandler);
