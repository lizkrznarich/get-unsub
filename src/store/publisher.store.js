import axios from "axios";
import Vue from "vue"
import router from "../router"

import {api} from "../api"
import {buildScenarioFromApiResp, newScenario, newScenarioId} from "../shared/scenario";
import _ from "lodash";

// https://www.npmjs.com/package/short-uuid
const short = require('short-uuid');

export const publisher = {
    state: {
        selected: null,

        isLoading: false,
        id: null,
        name: "",
        isDemo: false,
        scenarios: [],
        journalDetail: {},
        journalCounts: {
            analyzed: 0,
            missingPrices: 0,
            oa: 0,
            leftOrStopped: 0
        },
        dataFiles: [],
        bigDealCost: 0,

        // apc stuff
        apcHeaders: [],
        apcJournals: [],
        apcPapersCount: 0,
        apcAuthorsFractionalCount: 0,
        apcCost: 0,


    },
    mutations: {
        clearPublisher(state){
            state.isLoading = false
            state.id = null
            state.name = ""
            state.isDemo = false
            state.scenarios = []
            state.journalDetail = {}
            state.journalCounts = {
                analyzed: 0,
                missingPrices: 0,
                oa: 0,
                leftOrStopped: 0
            }
            state.dataFiles = []
            state.apcPapersCount = 0
            state.apcAuthorsFractionalCount = 0
            state.apcCost = 0
        },
        setSelectedPublisher(state, apiPublisher) {
            state.selected = apiPublisher // legacy

            state.id = apiPublisher.id
            state.name = apiPublisher.name
            state.isDemo = apiPublisher.is_demo
            state.scenarios = apiPublisher.scenarios
            state.journalDetail = apiPublisher.journal_detail
            state.journalCounts = {
                analyzed: 0,
                missingPrices: 0,
                oa: 0,
                leftOrStopped: 0
            }
            state.dataFiles = apiPublisher.data_files
            state.bigDealCost = apiPublisher.cost_bigdeal
        },
        clearSelectedPublisher(state) {
            state.selected = null
        },
        startLoading(state) {
            state.isLoading = true
        },
        finishLoading(state) {
            state.isLoading = false
        },
        deleteScenario(state, scenarioIdToDelete) {
            state.scenarios = state.scenarios.filter(s=>{
                return s.id !== scenarioIdToDelete
            })
        },
        renameScenario(state, {id, newName}) {
            state.scenarios.find(s=>{
                return s.id === id
            }).saved.name = newName
        },
        copyScenario(state, {id, newName, newId}) {
            const scenarioToCopy = state.scenarios.find(s=>{
                return s.id === id
            })
            const clone = _.cloneDeep(scenarioToCopy)
            clone.saved.name = newName
            clone.id = newId
            state.scenarios.push(clone)
        },
        createScenario(state, {newName, newId}) {
            const myNewScenario = newScenario(newId)
            myNewScenario.saved.name = newName
            state.scenarios.push(myNewScenario)
        },
    },
    actions: {
        async fetchPublisher({commit, dispatch, getters}, id) {
            commit("startLoading")

            await Promise.all([
                dispatch("fetchPublisherApcData", id),
                dispatch("fetchPublisherMainData", id),
            ])
            dispatch("hydratePublisherScenarios")
            commit("finishLoading")
            return
        },
        async fetchPublisherMainData({commit, dispatch, getters}, id) {
            if (getters.publisherBigDealCost) return

            const url = `publisher/${id}`
            const resp = await api.get(url)
            resp.data.scenarios = resp.data.scenarios.map(apiScenario => {
                const scenario = newScenario(apiScenario.id, apiScenario.name)
                scenario.isLoading = true
                return scenario
            });
            commit("setSelectedPublisher", resp.data)
            dispatch("hydratePublisherScenarios")
            return resp
        },

        async fetchPublisherApcData({commit, state, dispatch, getters}, id) {
            if (getters.publisherApcCost) return

            const url = `publisher/${id}/apc`
            const resp = await api.get(url)
            state.apcPapersCount = resp.data.headers.find(h=>h.value==="num_apc_papers").raw
            state.apcAuthorsFractionalCount = resp.data.headers.find(h=>h.value==="fractional_authorship").raw
            state.apcCost = resp.data.headers.find(h=>h.value==="cost_apc").raw
            state.apcHeaders = resp.data.headers
            state.apcJournals = resp.data.journals


            return resp
        },

        async hydratePublisherScenarios({dispatch, getters}) {
            getters.getScenarios.forEach(s => {
                dispatch("hydratePublisherScenario", s.id)
            })
        },

        async hydratePublisherScenario({dispatch, getters}, scenarioId) {
            const path = `scenario/${scenarioId}/journals`
            const resp = await api.get(path)
            const hydratedScenario = buildScenarioFromApiResp(resp.data)

            const myScenario = getters.publisherScenario(scenarioId)
            Object.keys(hydratedScenario).forEach(k => {
                myScenario[k] = hydratedScenario[k]
            })
            myScenario.isLoading = false
        },


        async copyScenario({commit, getters}, {id, newName}) {
            let newId = newScenarioId(getters.isPublisherDemo)
            commit("copyScenario", {id, newName, newId})
            const data = {
                name: newName,
                id: newId,
            }
            const url = `package/${getters.publisherId}/scenario?copy=${id}`
            await api.post(url, data)
        },
        async renameScenario({commit, getters}, {id, newName}) {
            commit("renameScenario", {id, newName})
            const url = `scenario/${id}`
            await api.post(url, getters.publisherScenario(id).saved)
        },
        async deleteScenario({commit, getters}, id) {
            commit("deleteScenario", id)
            router.push(`/a/${getters.publisherId}`)
            await api.delete(`scenario/${id}`)
        },
        async createScenario({commit, dispatch, getters}) {
            const newId = newScenarioId(getters.isPublisherDemo)
            const newName = "New Scenario"
            commit("createScenario", {newName, newId})
            const data = {
                id: newId,
                name: newName,
            }
            console.log("POSTing this to create scenario", data)
            const url = `package/${getters.publisherId}/scenario`
            await api.post(url, data)
            dispatch("hydratePublisherScenario", newId)

        },
    },
    getters: {
        selectedPublisher(state) {
            return state.selected
        },
        publisherName: (state) => {
            if (/Elsevier/.test(state.name)) return "Elsevier"
            if (!state.name) return "Elsevier"
            return state.name
        },
        publisherId: (state)  => state.id,
        publisherScenariosCount: (state) => state.scenarios.length,
        publisherScenario: (state) => (id) =>{
            return state.scenarios.find(s => s.id === id)
        },
        publisherScenariosAreAllLoaded: (state) =>{
            return state.scenarios.filter(s => s.isLoading).length === 0
        },
        getScenarios: (state) => state.scenarios,
        publisherScenarios: (state) => state.scenarios,
        isPublisherDemo: (state) =>  state.isDemo,
        publisherBigDealCost: (state) =>  state.bigDealCost,
        publisherIsLoading: (state) =>  state.isLoading,

        // apc stuff
        publisherApcPapersCount: (state) => state.apcPapersCount,
        publisherApcAuthorsFractionalCount: (state) => state.apcAuthorsFractionalCount,
        publisherApcCost: (state) =>  state.apcCost,
        publisherApcJournals: (state) =>  state.apcJournals,
        publisherApcHeaders: (state) =>  state.apcHeaders,
    }
}