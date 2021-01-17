import Vue from 'vue';
import vueCustomElement from 'vue-custom-element';

import BarfComponent from './BarfComponent.vue';

//// Configure Vue to ignore the element name when defined outside of Vue.
//Vue.config.ignoredElements = [
//  'barf-component'
//];

// Enable the plugin
Vue.use(vueCustomElement);

// Register your component
Vue.customElement('barf-component', BarfComponent);
