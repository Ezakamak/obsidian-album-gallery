'use strict';

const pluginModule = require('./main.base.js');
require('./media-runtime.js')(pluginModule);
module.exports = pluginModule;
