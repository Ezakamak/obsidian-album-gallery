'use strict';

module.exports = function installAlbumGalleryRuntime(pluginModule) {
	const pluginClass = pluginModule && (pluginModule.default || pluginModule);
	if (!pluginClass) return pluginModule;
	require('./runtime-styles.js')();
	require('./runtime-confirm.js')(pluginClass);
	require('./runtime-media.js')(pluginClass);
	return pluginModule;
};
