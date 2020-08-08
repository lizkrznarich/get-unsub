import axios from "axios";
import Vue from "vue"

import {api} from "../api"
import {buildScenarioFromApiResp, newScenario, newScenarioId} from "../shared/scenario";
import {makePublisherJournal} from "../shared/publisher";
import _ from "lodash";
import appConfigs from "../appConfigs";
import publisherFileConfigs from "../components/PublisherFile/publisherFileConfigs";
import {publisherLogoFromId} from "../shared/publisher";

// https://www.npmjs.com/package/short-uuid
const short = require('short-uuid');


export const publisher = {
    state: {
        selected: null,

        isLoading: false,
        apcIsLoading: false,

        id: null,
        publisher: "",
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
        journals: [],
        dataFiles: [],
        counterIsUploaded: false,
        bigDealCost: 0,
        isOwnedByConsortium: false,

        // apc stuff
        apcHeaders: [],
        apcJournals: [],
        apcPapersCount: null,
        apcAuthorsFractionalCount: null,
        apcCost: null,


    },
    mutations: {
        clearPublisher(state) {
            state.isLoading = false
            state.id = null
            state.publisher = ""
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
            state.journals = []
            state.dataFiles = []
            state.counterIsUploaded = false
            state.bigDealCost = 0

            state.apcHeaders = []
            state.apcJournals = []
            state.apcPapersCount = null
            state.apcAuthorsFractionalCount = null
            state.apcCost = null
            state.isOwnedByConsortium = false
        },
        clearApcData(state){
            state.apcHeaders = []
            state.apcJournals = []
            state.apcPapersCount = null
            state.apcAuthorsFractionalCount = null
            state.apcCost = null
        },

        setSelectedPublisher(state, apiPublisher) {
            state.selected = apiPublisher // legacy

            state.id = apiPublisher.id
            state.publisher = apiPublisher.publisher
            state.name = apiPublisher.name
            state.isDemo = apiPublisher.is_demo
            state.scenarios = apiPublisher.scenarios
            state.journalDetail = apiPublisher.journal_detail
            state.journalCounts = {
                analyzed: apiPublisher.journal_detail.counts.in_scenario,
                missingPrices: apiPublisher.journal_detail.diff_counts.diff_no_price,
                oa: apiPublisher.journal_detail.diff_counts.diff_open_access_journals,
                leftOrStopped: apiPublisher.journal_detail.diff_counts.diff_not_published_in_2019 + apiPublisher.journal_detail.diff_counts.diff_changed_publisher
            }
            state.journals = []
            state.journals = apiPublisher.journals.map(j => {
                return makePublisherJournal(j)
            })
            state.dataFiles = apiPublisher.data_files.map(dataFile => {
                dataFile.name = dataFile.name.replace("prices", "price")
                return dataFile
            })
            state.counterIsUploaded = state.dataFiles.findIndex(f => f.name === 'counter' && f.uploaded) > -1
            state.bigDealCost = apiPublisher.cost_bigdeal
            state.isOwnedByConsortium = apiPublisher.is_owned_by_consortium
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
            state.scenarios = state.scenarios.filter(s => {
                return s.id !== scenarioIdToDelete
            })
        },
        renameScenario(state, {id, newName}) {
            state.scenarios.find(s => {
                return s.id === id
            }).saved.name = newName
        },
        setScenarioConfig(state, {scenarioId, key, value}) {
            const ret = state.scenarios.find(s => {
                return s.id === scenarioId
            })
            ret.saved.configs[key] = value
            return ret

        },
        copyScenario(state, {id, newName, newId}) {
            const scenarioToCopy = state.scenarios.find(s => {
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
            myNewScenario.isLoading = true
            state.scenarios.push(myNewScenario)
        },

    },
    actions: {
        async fetchPublisher({commit, dispatch, getters}, id) {
            if (id == getters.publisherId) return
            commit("startLoading")
            await dispatch("fetchPublisherMainData", id)
            commit("finishLoading")
            return
        },
        async refreshPublisher({commit, dispatch, getters}) {
            commit("startLoading")
            await dispatch("fetchPublisherMainData", getters.publisherId)
            commit("finishLoading")
            return
        },


        async fetchPublisherMainData({commit, dispatch, getters}, id) {
            const url = `publisher/${id}`
            const resp = await api.get(url)
            resp.data.scenarios = resp.data.scenarios.map(apiScenario => {
                const scenario = newScenario(apiScenario.id, apiScenario.name)
                scenario.isLoading = true
                return scenario
            });
            commit("setSelectedPublisher", resp.data)
            await dispatch("hydratePublisherScenarios")
            return resp
        },

        async fetchPublisherApcData({commit, state, dispatch, getters}, id) {
            state.apcIsLoading = true

            const url = `publisher/${id}/apc`

            let resp
            try {
                resp = await api.get(url)
            } catch (e) {
                console.log("error loading publisher APC", e.response)
                resp = null
            } finally {
                state.apcIsLoading = false
            }

            if (resp) {
                state.apcPapersCount = resp.data.headers.find(h => h.value === "num_apc_papers").raw
                state.apcAuthorsFractionalCount = resp.data.headers.find(h => h.value === "fractional_authorship").raw
                state.apcCost = resp.data.headers.find(h => h.value === "cost_apc").raw
                state.apcHeaders = resp.data.headers
                state.apcJournals = resp.data.journals
                return resp
            }
            return

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
            console.log("gonna hydrate this scenario", scenarioId, myScenario)
            Object.keys(hydratedScenario).forEach(k => {
                if (k !== 'configs') {
                    myScenario[k] = hydratedScenario[k]
                }
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
        async setScenarioConfig({commit, getters, dispatch}, {scenarioId, key, value}) {
            // modify the scenario metadata in place...this doesn't actually recalculate anything.
            commit("setScenarioConfig", {scenarioId, key, value})

            // send the scenario obj, with its new config value, up to the server.
            // the server will save our new param value.
            const url = `scenario/${scenarioId}`
            await api.post(url, getters.publisherScenario(scenarioId).saved)

            // ask the server for the journals data for this scenario,
            // which will now be calculated using the new param we set a second ago.
            // overwrite the scenario data.
            await dispatch("hydratePublisherScenario", scenarioId)

        },
        async deleteScenario({commit, getters}, id) {
            commit("deleteScenario", id)
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
            return state.name
        },
        publisherLogo: (state) => {
            return publisherLogoFromId(state.publisher)
        },

        publisherId: (state) => state.id,
        publisherPublisher: (state) => state.publisher,
        publisherJournalCounts: (state) => state.journalCounts,
        publisherJournals: (state) => state.journals,
        publisherJournalsValid: (state) => state.journals.filter(j => j.isValid),
        publisherScenariosCount: (state) => state.scenarios.length,
        publisherScenario: (state) => (id) => {
            return state.scenarios.find(s => s.id === id)
        },
        publisherScenariosAreAllLoaded: (state) => {
            return state.scenarios.filter(s => s.isLoading).length === 0
        },
        getScenarios: (state) => state.scenarios,
        publisherScenarios: (state) => state.scenarios,
        isPublisherDemo: (state) => state.isDemo,
        publisherBigDealCost: (state) => state.bigDealCost,
        publisherIsLoading: (state) => state.isLoading,

        publisherFilesDict: (state) => {
            const ret = {}
            state.dataFiles.forEach(f => {
                const val = {
                    ...f,
                    id: _.camelCase(f.name),
                }
                ret[val.id] = val
            })
            return ret
        },

        publisherFiles: (state) => {
            return state.dataFiles.map(f => {

                const ret = {
                    ...f,
                    id: _.camelCase(f.name),
                }

                // if (f.error_rows) {
                //     ret.error_rows = {
                //         headers: [{name: "Row Number", id: "rowNo"}].concat(f.error_rows.headers),
                //         rows: f.error_rows.rows.map(row => {
                //             row.cells.rowNo = {value: row.row_no}
                //             return row
                //         })
                //     }
                // }


                return ret
            })
        },


        publisherCounterIsUploaded: (state) => state.counterIsUploaded,
        publisherIsOwnedByConsortium: (state) => state.isOwnedByConsortium,


        // apc stuff
        publisherApcIsLoading: (state) => state.apcIsLoading,
        publisherApcPapersCount: (state) => state.apcPapersCount,
        publisherApcAuthorsFractionalCount: (state) => state.apcAuthorsFractionalCount,
        publisherApcCost: (state) => state.apcCost,
        publisherApcJournals: (state) => state.apcJournals,
        publisherApcHeaders: (state) => state.apcHeaders,
    }
}