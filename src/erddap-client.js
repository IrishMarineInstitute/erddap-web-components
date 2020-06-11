/**
 * (c) Marine Institute
 *
 * Website: https://marine.ie/
 * Description: Create web based applications for ERDDAP
 *
 * MIT License
 *
 */
;
(function(global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
		typeof define === 'function' && define.amd ? define(factory) :
		global.ErddapClient = factory();
}(this, (function() {
	'use strict';
	let jsonpID = 0;

	function jsonp(url, options) {
		// derived from https://blog.logrocket.com/jsonp-demystified-what-it-is-and-why-it-exists/
		const head = document.querySelector('head');
		const timeout = options.timeout || 7500;
		const callbackName = options.callbackName || `jsonpCallback${jsonpID}`;
		jsonpID += 1;

		return new Promise((resolve, reject) => {
			let script = document.createElement('script');

			script.src = url + (url.indexOf("?")>=0? "&":"?")+`.jsonp=${callbackName}`;
			script.async = true;

			const timeoutId = window.setTimeout(() => {
				cleanUp();

				return reject(new Error('Timeout'));
			}, timeout);

			window[callbackName] = data => {
				cleanUp();

				return resolve(data);
			};

			script.addEventListener('error', error => {
				cleanUp();

				return reject(error);
			});

			function cleanUp() {
				window[callbackName] = undefined;
				head.removeChild(script);
				window.clearTimeout(timeoutId);
				script = null;
			}


			head.appendChild(script);
		});
	}

	var ErddapClient = function(url) {
		url = url || "https://coastwatch.pfeg.noaa.gov/erddap/";
		this.base_url = url.replace(/\/+$/, "");
		this._datasets = {};
	}

	const fetchJsonp = function(url, callbackName) {
		let options = {};
		if (callbackName) {
			options.callbackName = callbackName;
		}
		return jsonp(url, options);
	}
	ErddapClient.prototype.fetchAwesomeErddaps = function() {
		return fetchJsonp("https://irishmarineinstitute.github.io/awesome-erddap/erddaps.jsonp", "awesomeErddapsCb");
	}
	ErddapClient.prototype.search = function(query, page, itemsPerPage) {
		page = page || 1;
		itemsPerPage = itemsPerPage || 10000;
		var url = this.base_url + "/search/index.json?";
		var urlParams = new URLSearchParams("?");
		urlParams.set("searchFor", query);
		urlParams.set("page", page);
		urlParams.set("itemsPerPage", itemsPerPage);
		return fetchJsonp(url + urlParams.toString()).then(e2o);
	}

	ErddapClient.prototype.listDatasets = function(filter) {
		filter = filter || "NC_GLOBAL";
		return this.search(filter).then(function(datasets) {
			if (datasets && datasets.length) {
				return datasets.map((ds) => ds["Dataset ID"]).sort();
			}
			return [];
		});
	}

	var e2o = function(data) {
		var keys = data.table.columnNames;
		var results = [];
		data.table.rows.forEach(function(row) {
			var result = [];
			for (var i = 0; i < keys.length; i++) {
				result[keys[i]] = row[i];
			}
			results.push(result);
		});
		return results;
	};

	var time_encoder = function(value, istabledap) {
		if (value instanceof Date) {
			return istabledap ? value.toISOString2() : ("(" + value.toISOString2() + ")");
		}
		try {
			var m = new Date(value).toISOString2();
			return istabledap ? m : ("(" + m + ")");
		} catch (e) {
			return value;
		}
	}
	var ErddapDataset = function(erddap, dsid) {
		this.erddap = erddap;
		this.dataset_id = dsid;
		this.subsets = {};
		this._fetchMetadata = this.erddap.search("datasetID=" + this.dataset_id).then(function(data) {
			for (var i = 0; i < data.length; i++) {
				if (data[i]["Dataset ID"] === this.dataset_id) {
					return data[i];
				}
			}
			throw new Error("Unknown dataset: [" + dsid + "]");
		}.bind(this)).then(function(summary) {
			this._summary = summary;
			var url = this.erddap.base_url + "/info/" + this.dataset_id + "/index.json";
			return fetchJsonp(url).then(function(response) { // TODO: handle error
				var obj = {};
				for (var i = 0; i < response.table.rows.length; i++) {
					var row = response.table.rows[i];
					obj[row[0]] = obj[row[0]] || {};
					obj[row[0]][row[1]] = obj[row[0]][row[1]] || {};
					obj[row[0]][row[1]][row[2]] = obj[row[0]][row[1]][row[2]] || {};
					obj[row[0]][row[1]][row[2]].type = row[3];
					obj[row[0]][row[1]][row[2]].value = row[4];
				};
				return (obj);
			}).then(function(info) {
				var param_encoder = {};
				var dataset = {
					url: url,
					_fieldnames: [],
					_type: {}
				};
				try{
					dataset.title = info.attribute.NC_GLOBAL.title.value;
					dataset.institution = info.attribute.NC_GLOBAL.institution.value;
				}catch(e){}
				var subsetVariables = [];
				try {
					subsetVariables = info.attribute.NC_GLOBAL.subsetVariables.value.split(",").map(x => x.trim());

				} catch (e) {}
				var wanted = ["dimension", "variable"];
				for (var x = 0; x < wanted.length; x++) {
					var dimvar = wanted[x];
					if (!info[dimvar]) {
						continue;
					}

					if (dimvar === "dimension") {
						dataset.dimensions = {};
					}

					for (var key in info[dimvar]) {
						dataset._type[key] = "String";
						dataset._fieldnames.push(key);
						var etype = info[dimvar][key][""]["type"];
						var evalue = "" + info[dimvar][key][""]["value"];
						switch (etype) {
							case 'float':
							case 'double':
								param_encoder[key] = function(v) {
									return isNaN(v) ? null : v
								};
								dataset._type[key] = "Number"
								break;
							case 'int':
							case 'long':
							case 'short':
							case 'byte':
								param_encoder[key] = function(v) {
									return isNaN(v) ? null : v
								};
								dataset._type[key] = "Integer"
								break;
							case 'String':
							case 'char':
								param_encoder[key] = function(v) {
									return '"' + v + '"'
								};
								break;
							default:
								throw new Error('Unknown type [' + etype + '] for ' + dataset.id + '.' + key);
						}

						//var isTimeField = false;
						if (info.attribute[key] && info.attribute[key]["_CoordinateAxisType"]) {
							var axisType = info.attribute[key]["_CoordinateAxisType"].value;
							switch (axisType) {
								case "Time":
									dataset.time_dimension = key;
									param_encoder[key] = time_encoder;
									param_encoder['since'] = time_encoder;
									param_encoder['until'] = time_encoder;
									dataset._type[key] = "Time";
									break;
								case "Lat":
									dataset.lat_dimension = key;
									break;
								case "Lon":
									dataset.lon_dimension = key;
									break;
								default:
									break;
							}
						}

						if (dimvar !== "dimension" && info.dimension && evalue) {
							dataset.dimensions[key] = evalue.split(/[ ,]+/);
						}
						if (key === "time") {
							dataset.time_dimension = key;
							param_encoder[key] = time_encoder;
							dataset._type[key] = "Time";
						}
					}

				}
				dataset.param_encoder = param_encoder;
				dataset.base_url = this.erddap.base_url;
				dataset.id = this.dataset_id;
				dataset.info = info;
				dataset.subsetVariables = subsetVariables;
				dataset.encode = function(variable, constraint, value) {
					const encoded_value = this.param_encoder[variable](value);
					return `${variable}${constraint}${encoded_value}`;

				}.bind(dataset);
				dataset.subsets = this.subsets;
				this._meta = dataset;
				return dataset;
			}.bind(this));
		}.bind(this));

	}
	ErddapDataset.prototype.variables = function() {
		return this._meta.info.variable;
	}

	ErddapDataset.prototype.fetchMetadata = function() {
		return this._fetchMetadata;
	}
	ErddapDataset.prototype.prepareSubset = function(variable) {
		if (this.subsets[variable] === undefined) {
			this.subsets[variable] = null;
			this.fetchData(variable + "&distinct()").then(results => {
				this.subsets[variable] = results.map(o => o[variable]);
			})
		}

	}

	ErddapDataset.prototype.getDataUrl = function(formatExtension) {
		return this.erddap.base_url + "/tabledap/" + this.dataset_id + formatExtension + "?"
	}
	ErddapDataset.prototype.fetchData = function(dap) {
		var url = this.getDataUrl(".json") + dap;
		return fetchJsonp(url)
			.then(e2o);
	}

	ErddapClient.prototype.dataset = function(dsid) {
		this._datasets[dsid] = this._datasets[dsid] || new ErddapDataset(this, dsid);
		return this._datasets[dsid];
	}
	return ErddapClient
})));