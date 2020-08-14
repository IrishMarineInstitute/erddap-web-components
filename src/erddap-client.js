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
		[global.ErddapClient, global.ErddapClients] = factory();
}(this, (function() {
	'use strict';
	let jsonpID = 0;
	let awesomeErddaps;

	let JSONPfetcher = function() {
		this._promises = {};
	}
	JSONPfetcher.prototype.fetch = function(url, options) {
		// derived from https://blog.logrocket.com/jsonp-demystified-what-it-is-and-why-it-exists/
		options = options || {};
		if (!this._promises[url]) {
			let head = document.querySelector('head');
			let timeout = options.timeout || 30000;
			let callbackName = options.callbackName || `jsonpCallback${jsonpID}`;
			jsonpID += 1;
			let promise = new Promise((resolve, reject) => {
				let script = document.createElement('script');

				let cleanUp = () => {
					delete window[callbackName];
					head.removeChild(script);
					window.clearTimeout(timeoutId);
					script = null;
					delete this._promises[url];
				}

				script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + `.jsonp=${callbackName}`;
				script.async = true;

				let timeoutId = window.setTimeout(() => {
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

				head.appendChild(script);
			});
			this._promises[url] = promise;
		}
		return this._promises[url];
	}

	let DatasetCache = function() {
		this.jsonpfetcher = new JSONPfetcher();
		let dbresolver = (resolve, reject) => {
			let request = window.indexedDB.open('datasets', 7);
			request.onerror = () => {
				console.log("problem opening database");
				reject('datasets database failed to open');
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
			request.onupgradeneeded = (e) => {
				// Grab a reference to the opened database
				let db = e.target.result;
				//db.deleteObjectStore('jsonp');
				let jsonpStore = db.createObjectStore('jsonp', {
					keyPath: "url"
				});

				// Define what data items the objectStore will contain
				jsonpStore.createIndex('url', 'url', {
					unique: true
				});
				jsonpStore.createIndex('time', 'time', {
					unique: false
				});
				jsonpStore.createIndex('data', 'data', {
					unique: false
				});

				console.log('Database setup complete');
			};
		}
		this._connect = new Promise(dbresolver);
	}
	DatasetCache.prototype.connect = function() {
		return this._connect;
	}

	DatasetCache.prototype.getJSONP = function(url, options) {
		options = options || {};
		let expire_seconds = options.expire_seconds || (60 * 10); // ten minutes default
		return this.connect().then(db => new Promise((resolve, reject) => {
			let jsonp = db.transaction('jsonp').objectStore('jsonp');
			let cacheRequest = jsonp.get(url);
			let fetchAndCache = () => {
				resolve(this.jsonpfetcher.fetch(url, options).then(data => {
					//console.log("data",data);
					let cache = db.transaction(['jsonp'], 'readwrite').objectStore('jsonp');
					try {
						cache.put({
							url: url,
							timestamp: new Date().getTime(),
							data: data
						});
					} catch (k) {
						console.log(k)
					}
					return data;
				}));
			}
			cacheRequest.onsuccess = e => {
				if (cacheRequest.result && cacheRequest.result.timestamp + (expire_seconds * 1000) > new Date().getTime()) {
					resolve(cacheRequest.result.data);
				} else {
					fetchAndCache();
				}
			};
			cacheRequest.onerror = e => {
				console.log("cache problem", e);
				fetchAndCache();
			}
		}));
	}

	let datasetCache = new DatasetCache();

	/**
	 * Sends out one request at a time
	 * Used for fetching/caching the metadata of the search results,
	 * without overwhelming the ERDDAP servers.
	 * TODO: politeness queue per ERDDAP server, not one overall.
	 */
	let PoliteFetcher = function() {
		let _queue = [];
		let _promises = {};
		let _reject = {};
		let _resolve = {};
		let processing = 0;
		let process = () => {
			if (processing) return;
			let url = _queue.shift();
			if (url) {
				++processing;
				ErddapClient.fetchJsonp(url)
					.then(data => {
						_resolve[url](data);
					})
					.catch(e => {
						console.log(e);
						if(_reject[url]){
							_reject[url](e);
						}
					})
					.finally(() => {
						delete _promises[url];
						delete _resolve[url];
						delete _reject[url];
						processing--;
						setTimeout(process, 0)
					});
			}
		}

		this.enqueue = (url) => {
			let promise = _promises[url];
			if (!promise) {
				let fn = (resolve,reject)=>{
					_resolve[url] = resolve;
					_reject[url] = reject;
				};
				promise = new Promise(fn);
				_promises[url] = promise;
				_queue.push(url);
				setTimeout(process, 0)
			}
			return promise;
		}
	}

	let politeFetcher = new PoliteFetcher();

	const DatasetsIndex = function(erddapClient){
		this.erddapClient = erddapClient;
		this.years = [];
		this.indices = [];
		this.yearmap = [];
	}

	DatasetsIndex.prototype.load = function(){
		if(!this.erddapClient){
			throw("Cannot call load on DatasetsIndex not created with an ErddapCliuent")
		}
		return this.erddapClient.getDataset("datasetsIndex")
			.fetchData("year&distinct()").then(data=>{
				this.years = data.map(r=>r.year);
				return this;
			})

	}

	DatasetsIndex.prototype.add = function(datasetIndex){
		if(this.erddapClient){
			throw("Cannot call add on DatasetsIndex created with an ErddapCliuent")
		}
		this.indices.push(datasetIndex)
		let years = this.years.concat(datasetIndex.years);
		this.years = years.filter((v,i)=>years.indexOf(v) === i);
		this.years.sort();
		this.yearmap = {};
		this.years.map(year=>this.yearmap[year] = []);
	}

	const fixLonRange = function(lon){
		while(lon<-180){
			lon += 360;
		}
		while(lon>180){
			lon -= 360;
		}
		return lon;
	}

	const boundsToDap = function(latLngBounds){
		if(!latLngBounds){
			return [""];
		}
		swlat = latLngBounds.getSouthWest().lat;
		swlon =fixLonRange(latLngBounds.getSouthWest().lon);
		nelat = latLngBounds.getNorthEast().lat;
		nelon = fixLonRange(latLngBounds.getNorthEast().lon);
		if(swlat > nelat || swlat < -90 || nelat > 90){
			throw(`out of bounds lat range ${swlat}-${nelat}`)
		}
		let latdap = `latitude>=${swlat}&latitude<=${nelat}`; 
		if(swlon<=nelon){
			return [`&${latdap}&longitude>=${swlon}&longitude<=${nelon}`]
		}else{
			return [`&${latdap}&longitude>=${swlon}&longitude<=180`,`&${latdap}&longitude>=-180&longitude<=${nelon}`]
		}

	}

	DatasetsIndex.prototype.setBounds = function(latLngBounds){
		if(this.erddapClient){
			return Promise.all(boundsToDap(latLngBounds).map(dap=>
				this.erddapClient.getDataset("datasetsIndex")
				.fetchData(`year,dataset_id${dap}&distinct()`)))
			.then(datas=>{
					let results = {};
					this.years.map(year=>results[year] = []);
					datas.map(data=>{
						data.map(row=>{
							results[row.year].push(this.erddapClient.getDataset(row.dataset_id).datasetUrl()+"/index.json");
						})
					})
					this.yearmap = results;
					return results;
				})

		}
		return Promise.all(this.indices.map(x=>x.setBounds(latLngBounds))).then(maps=>{
			let results = {};
			this.years.map(year=>results[year] = []);
			maps.map(map=>{
				Object.keys(map).forEach(year=>{
					map[year].map(dataset_url=>{
						results[year].push(dataset_url)
					})
				})
			})
			this.yearmap = results;
			return results;
		})
	}

	const ErddapClient = function(settings) {
		if (typeof(settings) === "string") {
			settings = {
				url: settings
			};
		}
		this.settings = settings || {};
		settings.url = settings.url || "https://coastwatch.pfeg.noaa.gov/erddap/";
		this.endpoint = settings.url.replace(/\/+$/, "");
		this.disabledkey = this.endpoint + ".disabled";
		this.settings.disabled = localStorage.getItem(this.disabledkey) ? true : false;
		this._datasets = {};
	}

	ErddapClient.fetchJsonp = function(url, options) {
		return datasetCache.getJSONP(url, options);
	}

	ErddapClient.politeFetchJsonp = function(url) {
		return politeFetcher.enqueue(url);
	}

	ErddapClient.fetchAwesomeErddaps = () => {
		if (!awesomeErddaps) {
			awesomeErddaps = ErddapClient.fetchJsonp("https://irishmarineinstitute.github.io/awesome-erddap/erddaps.jsonp", {
				callbackName: "awesomeErddapsCb"
			});
		}
		return awesomeErddaps.then(results => JSON.parse(JSON.stringify(results)));
	}

	ErddapClient.fetchDataset = function(dataset_url) {
		let [erddap_url, dataset_id] = dataset_url.split(/\/info\//);
		return new ErddapClient({
			url: erddap_url
		}).getDataset(dataset_id).fetchMetadata();
	}

	ErddapClient.prototype.search = function(query, page, itemsPerPage) {
		page = page || 1;
		itemsPerPage = itemsPerPage || 10000;
		let url = this.endpoint + "/search/index.json?";
		let urlParams = new URLSearchParams("?");
		urlParams.set("searchFor", query);
		urlParams.set("page", page);
		urlParams.set("itemsPerPage", itemsPerPage);
		let promise = ErddapClient.fetchJsonp(url + urlParams.toString()).then(e2o).then(datasets => {
			if (datasets) {
				datasets.forEach(dataset => {
					dataset.id = dataset["Dataset ID"];
					dataset.url = this.endpoint + "/info/" + dataset.id;
				})

			}
			return datasets;
		});
		return promise;
	}

	ErddapClient.prototype.listDatasets = function(filter) {
		filter = filter || "NC_GLOBAL";
		return this.search(filter).then(function(datasets) {
			if (datasets && datasets.length) {
				return datasets.sort((a, b) => a.id.localeCompare(b.id));
			}
			return [];
		});
	}

	ErddapClient.prototype.testConnect = function() {
		this.settings.connected = false;
		return new Promise((resolve, reject) => {
			this.search("time", 1, 1, 5000).then(() => {
					this.settings.connected = true;
					resolve(true);
				})
				.catch(function(e) {
					//console.log("(testConnect)", e);
					resolve(false);
				});
		});
	}

	const e2o = function(data) {
		let keys = data.table.columnNames;
		let results = [];
		data.table.rows.forEach(function(row) {
			let result = [];
			for (let i = 0; i < keys.length; i++) {
				result[keys[i]] = row[i];
			}
			results.push(result);
		});
		return results;
	};

	const time_encoder = function(value, istabledap) {
		if (value instanceof Date) {
			return istabledap ? value.toISOString2() : ("(" + value.toISOString2() + ")");
		}
		try {
			let m = new Date(value).toISOString2();
			return istabledap ? m : ("(" + m + ")");
		} catch (e) {
			return value;
		}
	}
	let ErddapDataset = function(erddap, dsid) {
		this.erddap = erddap;
		this.dataset_id = dsid;
		this.subsets = {};
		this._fetchMetadata = this.erddap.search("datasetID=" + this.dataset_id).then((data) => {
			for (let i = 0; i < data.length; i++) {
				if (data[i]["Dataset ID"] === this.dataset_id) {
					return data[i];
				}
			}
			throw new Error("Unknown dataset: [" + dsid + "]");
		}).then((summary) => {
			this._summary = summary;
			let url = this.datasetUrl() + "/index.json";
			return ErddapClient.fetchJsonp(url).then(response => { // TODO: handle error
				let obj = {};
				for (let i = 0; i < response.table.rows.length; i++) {
					let row = response.table.rows[i];
					obj[row[0]] = obj[row[0]] || {};
					obj[row[0]][row[1]] = obj[row[0]][row[1]] || {};
					obj[row[0]][row[1]][row[2]] = obj[row[0]][row[1]][row[2]] || {};
					obj[row[0]][row[1]][row[2]].type = row[3];
					obj[row[0]][row[1]][row[2]].value = row[4];
				};
				return (obj);
			}).then(info => {
				let param_encoder = {};
				let dataset = {
					url: url,
					_fieldnames: [],
					_type: {}
				};
				try {
					dataset.title = info.attribute.NC_GLOBAL.title.value;
					dataset.institution = info.attribute.NC_GLOBAL.institution.value;
				} catch (e) {}
				let subsetVariables = [];
				try {
					subsetVariables = info.attribute.NC_GLOBAL.subsetVariables.value.split(",").map(x => x.trim());

				} catch (e) {}
				let wanted = ["dimension", "variable"];
				for (let x = 0; x < wanted.length; x++) {
					let dimvar = wanted[x];
					if (!info[dimvar]) {
						continue;
					}

					if (dimvar === "dimension") {
						dataset.dimensions = {};
					}

					for (let key in info[dimvar]) {
						dataset._type[key] = "String";
						dataset._fieldnames.push(key);
						let etype = info[dimvar][key][""]["type"];
						let evalue = "" + info[dimvar][key][""]["value"];
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

						//let isTimeField = false;
						if (info.attribute[key] && info.attribute[key]["_CoordinateAxisType"]) {
							let axisType = info.attribute[key]["_CoordinateAxisType"].value;
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
				dataset.endpoint = this.erddap.endpoint;
				dataset.id = this.dataset_id;
				dataset.info = info;
				dataset.subsetVariables = subsetVariables;
				dataset.encode = (variable, constraint, value) => {
					let encoded_value = this.param_encoder[variable](value);
					return `${variable}${constraint}${encoded_value}`;

				};
				dataset.subsets = this.subsets;
				this._meta = dataset;
				return dataset;
			}).catch(e => {
				console.log("something went wrong", e);
			});
		});

	}
	ErddapDataset.prototype.datasetUrl = function() {
		return this.erddap.endpoint + "/info/" + this.dataset_id;
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
		return this.erddap.endpoint + "/tabledap/" + this.dataset_id + formatExtension + "?"
	}

	ErddapDataset.prototype.fetchData = function(dap) {
		let url = this.getDataUrl(".json") + dap;
		return ErddapClient.fetchJsonp(url)
			.then(e2o);
	}

	ErddapClient.prototype.getDataset = function(dsid) {
		this._datasets[dsid] = this._datasets[dsid] || new ErddapDataset(this, dsid);
		return this._datasets[dsid];
	}

	const ErddapClients = function(configs, includeCustomConfigs) {
		this.erddaps = configs.map(function(e) {
			return new ErddapClient(e)
		});
		if (includeCustomConfigs) {
			let customErddaps = this.getCustomConfigs().map(function(e) {
				return new ErddapClient(e)
			});
			for (let i = customErddaps.length - 1; i >= 0; i--) {
				let include = true;
				for (let j = 0; j < this.erddaps.length; j++) {
					if (this.erddaps[j].endpoint == customErddaps[i].endpoint) {
						include = false;
						break;
					}
				}
				if (include) {
					this.erddaps.unshift(customErddaps[i]);
				}
			}
			this.saveCustomConfigs();
		}
		this.searchId = 0;
		this.activeSearchCallback = undefined;
	}
	ErddapClients.prototype.testConnect = function(onStatusChanged) {
		let nerddaps = this.erddaps.length;
		let remaining = nerddaps;
		let promises = this.erddaps.map((erddap) =>
			erddap.testConnect().then(() => {
				onStatusChanged && onStatusChanged({
					total: nerddaps,
					remaining: --remaining
				});
				if (this.activeSearchCallback && erddap.settings && erddap.settings.connected && !erddap.settings.disabled) {
					this.activeSearchCallback(erddap);
				}
			})
		);
		return Promise.all(promises).then(() => this.erddaps);
	}
	ErddapClients.prototype.search = function(options) {
		let {
			query,
			onResultStatusChanged,
			onHit,
			fetchMetadata
		} = options;
		let currentSearchId = ++this.searchId;
		let startTime = (new Date()).getTime();
		let erddaps = this.erddaps.filter(function(erddap) {
			return erddap && erddap.settings && erddap.settings.connected && !erddap.settings.disabled;
		});
		let nsearches = erddaps.length;
		let nerddaps = nsearches;
		let nerddapResults = 0;
		let hits = 0;

		let reportStatus = (err) => {
			let search_time = (new Date()).getTime() - startTime;
			onResultStatusChanged({
				nerddaps: nerddaps,
				awaiting: nsearches,
				results: nerddapResults,
				hits: hits,
				err: err,
				search_time: search_time,
				finished: nsearches === 0
			});
		}
		let search = erddap => {
			erddap.search(query).then(result => {
				if (currentSearchId !== this.searchId) {
					return;
				}
				--nsearches;
				if (result && result.length) {
					hits += result.length;
					++nerddapResults;
					while (result.length) {
						let data = result.shift();
						if (fetchMetadata) politeFetcher.enqueue(data.Info);
						if (onHit) {
							setTimeout(() => {
								onHit(data)
							}, 0)
						}
					}
				}
				reportStatus();
			}, () => {
				--nsearches;
				reportStatus();
			}).catch(err => {
				--nsearches;
				reportStatus(err);
			});
		};
		this.activeSearchCallback = erddap => {
			++nsearches;
			++nerddaps;
			search(erddap);
		}
		erddaps.forEach(search);
	}
	ErddapClient.prototype.loadDatasetsIndex = function(){
		let datasetsIndex = new DatasetsIndex(this);
		return datasetsIndex.load().catch(e=>{
			console.log("datasetsIndex not loaded for "+this.endpoint);
			return undefined;
		})
	}
	ErddapClients.prototype.loadDatasetsIndex = function(){
		let promises = this.erddaps.map((erddap) =>
			erddap.loadDatasetsIndex()
		);
		return Promise.all(promises).then((indices) => {
			let datasetsIndex = new DatasetsIndex();
			for(let i=0;i<indices.length;i++){
				if(!indices[i]){
					return null;
				}
				datasetsIndex.add(indices[i]);
			}

			return datasetsIndex;

		});


	}
	return [ErddapClient, ErddapClients];
})));