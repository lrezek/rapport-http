'use strict';

const util = require('../util.js');

/**
 * @typedef {object} HTTP
 * @property {function} body
 * @property {function} query
 * @property {function} timeout
 * @property {function} send
 */

/**
 * Translates a response from a websocket packet.
 *
 * @param {*} res The response.
 */
const translateResponse = (res) => {
    if (res) {
        res.status = res._s;
        delete res._s;

        res.body = res._b;
        delete res._b;
    }

    return res;
};

/**
 * Makes a HTTP-like request on the socket.
 *
 * @param {object} wrappedSocket The wrapped socket.
 * @param {object} options The rapport options.
 * @param {string} method The request method to use.
 * @param {string} url The request url.
 * @return {HTTP} The request promise if promises are enabled, or undefined.
 */
module.exports = (wrappedSocket, options, method, url) => {

    if (!util.isString(method)) {
        throw new TypeError('HTTP method must be a string');
    }

    if (!util.isString(url)) {
        throw new TypeError('HTTP URL must be a string');
    }

    const http = {

        _method: method,
        _url: url,
        _body: {},
        _timeout: 0,
        _expectResponse: true,

        /**
         * Adds a body to the request. If an object is supplied, the body will be appended with the objects keys and values.
         * If a anything but an object is supplied, the body is overwritten with the supplied value.
         *
         * @param {*} body The body to add to the request.
         * @return {HTTP} The HTTP object, for chaining.
         */
        body: (body) => {
            if (util.isObject(body)) {
                util.forEach(body, (key, value) => {
                    http._body[key] = value;
                });

            } else {
                http._body = body;
            }
            return http;
        },

        /**
         * Adds query parameters to the request url. If an object is supplied, the keys and values are URI encoded and
         * appended to the URL. If a string is supplied, it is appended ot the end of the URL as is. If an array is supplied,
         * it is joined with "&" and the resulting string is appended to the url.
         *
         * @param {object|string|array} query The query parameters.
         * @return {HTTP} The HTTP object, for chaining.
         */
        query: (query) => {
            if (query) {
                let queryString = '';

                if (util.isString(query)) {
                    queryString = query;

                } else if (util.isArray(query)) {
                    queryString = query.join('&');

                } else if (util.isObject(query)) {
                    const queryArray = [];

                    util.forEach(query, (key, value) => {
                        queryArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    });
                    queryString = queryArray.join('&');

                } else {
                    throw new TypeError('Query must be a url encoded string, object, or array');
                }


                if (http._url.indexOf('?') >= 0) {
                    http._url = `${http._url}&${queryString}`;
                } else {
                    http._url = `${http._url}?${queryString}`;
                }
            }
            return http;
        },

        /**
         * Sets a timeout for the request, in milliseconds.
         *
         * @param {number} ms The length of the timeout, in milliseconds.
         * @return {HTTP} The HTTP object, for chaining.
         */
        timeout: (ms) => {
            if (!util.isNumber(ms)) {
                throw new TypeError('Timeout must be a numeric value');
            }

            if (ms > 0) {
                http._timeout = ms;
            }
            return http;
        },

        /**
         * Whether to expect a response. If set to false, the request/response flow will be bypassed, and a routable
         * message will be sent without returning a promise or calling a callback.
         *
         * @param {boolean} responseExpected Whether a response is expected.
         * @return {HTTP} The HTTP object, for chaining.
         */
        expectResponse: (responseExpected) => {
            http._expectResponse = responseExpected;
            return http;
        },

        /**
         * Sends the request. If promises are enabled, this returns a promise. Otherwise, a callback must be supplied.
         *
         * @param {function} [cb] The callback to use.
         * @return {Promise|undefined} A promise if promises are enabled, or undefined if using a callback flow.
         */
        send: (cb) => {
            const body = {
                _m: http._method,
                _u: http._url,
                _b: http._body
            };

            // If we're not expecting a response, do a send and report errors on the callback/promise
            if (!http._expectResponse) {
                try {
                    wrappedSocket.send(body);
                } catch (err) {

                    if (!cb) {
                        return options.Promise.reject(err);
                    }

                    cb(null, err);
                }

                return;
            }

            // If we're using callback flow, do the request with a callback
            if (cb) {
                return wrappedSocket.request(body, http._timeout, (res, err) => {
                    cb(translateResponse(res), translateResponse(err));
                });
            }

            // If we're using promise flow, do the request using that
            return wrappedSocket.request(body, http._timeout)
                .then(translateResponse, (err) => {
                    throw translateResponse(err);
                });
        }
    };

    return http;
};
