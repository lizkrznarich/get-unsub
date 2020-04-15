import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify';

import VueCurrencyFilter from 'vue-currency-filter'

Vue.use(VueCurrencyFilter, {
    symbol: '$',
    thousandsSeparator: ',',
    fractionCount: 0,
    fractionSeparator: '.',
    symbolPosition: 'front',
    symbolSpacing: false
})


import Donut from 'vue-css-donut-chart';
import 'vue-css-donut-chart/dist/vcdonut.css';

Vue.use(Donut);

Vue.use(require('vue-shortkey'))


import VueAnalytics from 'vue-analytics'

Vue.use(VueAnalytics, {
    id: "UA-23384030-10",
    router
})


import VueIntercom from 'vue-intercom';

Vue.use(VueIntercom, {appId: 'dc7bcjeo'});

import Jazzicon from 'vue-jazzicon';
Vue.component('jazzicon', Jazzicon);

import Gravatar from 'vue-gravatar';
Vue.component('v-gravatar', Gravatar);

import VueClipboard from 'vue-clipboard2'
Vue.use(VueClipboard)



const rounder = function (value, decimals) {
    if (!value) {
        return 0
    }

    if (!decimals) {
        decimals = 0
    }

    if (value < 1) {
        decimals = 2
    }

    value = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)

    // https://stackoverflow.com/a/43539443/226013
    const localStrOpts = {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
    }
    return value.toLocaleString(undefined, localStrOpts)
}

Vue.config.productionTip = false
Vue.filter('round', function (value, decimals) {
  return rounder(value, decimals)
})

Vue.filter('percent', function (value, decimals) {
  return rounder(value, decimals) + "%"
})


new Vue({
    router,
    store,
    vuetify,
    render: h => h(App)
}).$mount('#app')
