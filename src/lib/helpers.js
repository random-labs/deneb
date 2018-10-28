/**
 * Deneb.
 *
 * Various helper functions.
 *
 * @module helpers
 * @license Apache-2.0
 */




import axios from "axios"
import bcrypt from "bcrypt"
import { array } from "@xcmats/js-toolbox"
import { apiKey } from "../config/configuration.json"




/**
 * ...
 *
 * @function errorMessageToRetCode
 * @param {String} message
 */
export const errorMessageToRetCode = (message) => {
    let errorCode = null
    switch (true) {
        case (message.match(/duplicate key/) !== null):
            errorCode = 409
            break

        default:
            errorCode = 500
            break
    }
    return errorCode
}




/**
 * ...
 *
 * @async
 * @param {*} base
 * @param {*} quot
 */
export const fetchCMC = (base = "stellar", quot = "eur") =>
    axios.get(`https://api.coinmarketcap.com/v1/ticker/${base}/?convert=${quot}`)
        .then((response) => {
            return {
                data: array.head(response.data),
            }
        })
        .catch((error) => {
            throw new Error(JSON.stringify({
                status: error.response.status,
                statusText: error.response.statusText,
            }))
        })




/**
 * ...
 */
export const getApiKey = () => apiKey




/**
 * ...
 *
 * @param {*} token
 * @param {*} userId
 */
export const tokenIsValid = (token, userId) =>
    bcrypt.compareSync(
        `${getApiKey()}${userId}`,
        Buffer.from(token, "base64").toString("ascii")
    )