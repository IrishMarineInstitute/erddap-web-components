/**
 * (c) Marine Institute
 *
 * Website: https://marine.ie/
 * Description: Create web based applications for ERDDAP
 *
 * MIT License
 *
 */
(function() {
    if (typeof(ErddapClient) === 'undefined') {
        console.log("erddap-client.js must be loaded before erddap-web-components.js");
    }
    let mapId = 0;
    const ErddapTools = {
        addLinks: function(text) {
            // see https://stackoverflow.com/questions/37684/how-to-replace-plain-urls-with-links
            // http://, https://, ftp://
            var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

            // www. sans http:// or https://
            var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

            // Email addresses
            var emailAddressPattern = /[\w.-]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,20})+/gim;

            return ("" + text)
                .replace(urlPattern, '<a title="opens in a new window" target="_blank" href="$&">$&</a>')
                .replace(pseudoUrlPattern, '$1<a title="opens in a new window" target="_blank" href="http://$2">$2</a>')
                .replace(emailAddressPattern, '<a target="_blank" href="mailto:$&">$&</a>');
        },
        ncglobals: function(dataset) {
            var info = {};
            var keys = Object.keys(dataset.info.attribute.NC_GLOBAL);
            keys.forEach(key => {
                info[key] = dataset.info.attribute.NC_GLOBAL[key].value;
            });
            return info;
        },
        metadataTable: function(dataset,table) {
            var metadata = ErddapTools.ncglobals(dataset);
            var email = {
                "@": '<i class="fa fa-envelope"></i> '
            };
            var url = {
                "ftp": '<i class="fa fa-external-link-alt"></i> ',
                "http": '<i class="fa fa-external-link-alt"></i> '
            }
            var datatype = {
                "grid": '<i class="fas fa-th"></i> ',
                "table": '<i class="fas fa-table"></i> ',
                "timeseries": '<i class="far fa-calendar"></i> ',
                "trajectory": '<i class="fa fa-location-arrow"></i> ',
                "point": '<i class="fas fa-map-marked-alt"></i> '
            };
            var personinst = {
                "person": '<i class="fas fa-user"></i> ',
                "institution": '<i class="fas fa-university"></i> ',
            };
            var extras = {
                cdm_data_type: datatype,
                creator_email: email,
                creator_type: personinst,
                creator_url: url,
                featureType: datatype,
                infoUrl: url,
                institution: { //TODO: move to config file
                    "Marine Institute": "<img height='16' src='mi_logo_bw.png' alt='Marine Institute' /> ",
                },
                license: { //TODO: move to config file
                    "Creative Commons Attribution 4.0": "<img height='16' src='cc-by-attribution.png' alt='CC BY' /> "
                },
                projection_type: {
                    "map": '<i class="fas fa-map"></i> '
                },
                publisher_email: email,
                publisher_type: personinst,
                publisher_url: url,
                source: {
                    "satellite": '<i class="fas fa-satellite"></i> ',

                },
                sourceUrl: {
                    "local files": '<i class="fa fa-copy"></i> ',
                    "local file": '<i class="fa fa-copy"></i> ',
                    "database": '<i class="fa fa-database"></i> ',
                    "cassandra": '<i class="fa fa-database"></i> ',
                    "ftp": '<i class="fa fa-external-link-alt"></i> ',
                    "http": '<i class="fa fa-external-link-alt"></i> '
                },
            }
            var default_extras = {
                license: '<i class="fa fa-balance-scale"></i> ',
                institution: '<i class="fas fa-university"></i> ',
                satellite: '<i class="fas fa-satellite"></i> ',
                projection: '<i class="fas fa-atlas"></i> '
            }

            var seen = [];
            var mtds = {};
            var addItem = function(irow, key, colspan) {
                seen.push(key);
                var h = document.createElement('th');
                h.setAttribute("style", "text-align: right");
                h.innerText = key;
                var d = document.createElement('td');
                if (colspan) {
                    d.setAttribute("colspan", colspan);
                }
                var html = ErddapTools.addLinks(metadata[key]);
                var foundExtra = false;
                if (extras[key]) {
                    var htmlLowerCase = html.toLowerCase();
                    Object.keys(extras[key]).forEach(function(string) {
                        if (!foundExtra) {
                            if (htmlLowerCase.indexOf(string.toLowerCase()) >= 0) {
                                html = extras[key][string] + html;
                                foundExtra = true;
                            }
                        }
                    })
                }
                if (default_extras[key] && !foundExtra) {
                    html = default_extras[key] + html;
                }
                d.innerHTML = html;
                irow.appendChild(h);
                irow.appendChild(d);
                mtds[key] = d;
            }
            var addRow = function(key, colspan) {
                if (metadata[key] === undefined || seen.indexOf(key) >= 0) {
                    return;
                }
                var irow = table.insertRow(-1);
                addItem(irow, key, colspan);
                return irow;
            };
            var addPair = function(a, b) {
                var irow = addRow(a);
                if (irow) {
                    addItem(irow, b);
                }
            };

            ["title", "institution", "cdm_data_type", "summary", "license"].forEach(function(key) {
                addRow(key, 3);
            });
            addPair("time_coverage_start", "time_coverage_end");
            var spatial = ["geospatial_lat_min", "geospatial_lat_max", "geospatial_lon_min", "geospatial_lon_max"];
            var mapDivId = false;
            var bounds = [];
            var point = false;
            if (spatial.filter(function(s) {
                    return metadata[s] !== undefined;
                }).length == spatial.length) {
                bounds = [
                    [metadata["geospatial_lat_min"], metadata["geospatial_lon_min"]],
                    [metadata["geospatial_lat_max"], metadata["geospatial_lon_max"]]
                ];
                try {
                    var parsedRoundedBounds = bounds.map(function(x) {
                        return Math.round(parseFloat(x) * 1000);
                    });
                    if (parsedRoundedBounds[0] == parsedRoundedBounds[1] && parsedRoundedBounds[2] == parsedRoundedBounds[3]) {
                        point = bounds[0];
                    }
                } catch (oh_well) {};

                // let's add a map.
                Object.keys(metadata).forEach(function(key) {
                    if (key.startsWith("geospatial_") && spatial.indexOf(key) < 0)
                        spatial.push(key);
                });
                spatial.sort(function(a, b) {
                    var sub = function(s) {
                        return s.replace("_min", "_maa");
                    };
                    var x = sub(a);
                    var y = sub(b);
                    if (x < y) {
                        return -1;
                    }
                    if (x > y) {
                        return 1;
                    }
                    return 0;
                });
                var mapRow = addRow(spatial[0]);
                spatial.forEach(function(key) {
                    addRow(key);
                });
                var mapCell = mapRow.insertCell(-1);
                mapCell.setAttribute("rowspan", spatial.length);
                mapCell.setAttribute("colspan", 2);
                mapCell.setAttribute("width", "50%");
                let mapDiv = document.createElement('div');
                mapDivId = `map_${mapId++}`;
                mapDiv.setAttribute("id",mapDivId)
                mapDiv.setAttribute("style", "height: " + (spatial.length * 36) + "px;");
                mapCell.appendChild(mapDiv);
                if(typeof(L) !== "undefined"){
                    var map = L.map(mapDiv, {
                        attributionControl: false
                    });
                    L.control.attribution({
                        position: "bottomleft"
                    }).addTo(map);
                    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);
                    map.fitBounds(bounds);

                    if (point) {
                        var marker = L.marker(point).addTo(map);
                        marker.bindPopup(metadata["title"]).openPopup();
                        map.setView(point, 9);
                    } else {
                        L.rectangle(bounds, {
                            color: "#ff7800",
                            weight: 1
                        }).addTo(map);
                    }
                }
            }
            addPair("Northernmost_Northing", "Easternmost_Easting");
            addPair("Southernmost_Northing", "Westernmost_Easting");
            var irow = addRow("time_coverage_start");
            if (irow) {
                addItem("time_coverage_end");
            }

            Object.keys(metadata).forEach(function(key) {
                addRow(key, 3);
            });
            return table;
        }
    }
    const ss_fontawesome = "https://use.fontawesome.com/releases/v5.7.2/css/all.css";
    const ss_leaflet = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.css";
    const ss_bootstrap = "https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css";
    function stylesheet(href){
        let link = document.createElement("link");
        link.setAttribute("rel","stylesheet");
        link.setAttribute("href",href);
        return link;
    }
    class ErddapWebComponents extends HTMLElement{
        constructor() {
            super();
            let shadow = this.attachShadow({mode: 'open'});
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            let slot = document.createElement("slot");
            let container = document.createElement("div");
            container.setAttribute("class","container");
            container.appendChild(slot);
            shadow.appendChild(container);
            let script = document.createElement("script");
            script.setAttribute("src","https://unpkg.com/leaflet@1.6.0/dist/leaflet.js");
            shadow.appendChild(script);
        }

    }
    window.customElements.define('erddap-web-components', ErddapWebComponents);

    class ErddapServerSelect extends HTMLElement {
        constructor() {
            super();
            let shadow = this.attachShadow({mode: 'closed'});
            shadow.appendChild(stylesheet(ss_bootstrap));
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            new ErddapClient().fetchAwesomeErddaps().then((items)=>{
                this.erddaps = items;
                this.init();
            });
        }

        get value() {
            return this.getAttribute("value");
        }

        set value(value) {
            this.setAttribute("value", value);
        }

        init() {
            if (this.erddaps && !this.container.firstChild) {
                let selected_url = this.getAttribute("value");
                let fieldset = document.createElement('fieldset');
                fieldset.setAttribute("class", "border p-2");
                var legend = document.createElement('legend');
                legend.setAttribute("class","w-auto");
                legend.innerText = "ERDDAP Server";
                fieldset.appendChild(legend);
                let select = document.createElement('select');
                select.setAttribute("class","form-control form-control-sm");
                select.value = selected_url;
                this.erddaps.forEach(item => {
                    let option = document.createElement('option');
                    option.setAttribute('value', item.url);
                    if (item.url === selected_url) {
                        option.setAttribute('selected', true);
                    }
                    option.innerText = item.name || item.short_name || item.url;
                    select.appendChild(option)
                })
                select.addEventListener('change', (k)=>{
                    this.value = k.target.value;
                    this.dispatchEvent(new Event('change',{bubbles: true, composed: true}));
                });
                fieldset.appendChild(select);
                this.container.appendChild(fieldset);
                //TODO this would be useful only if we wanted to change the list...
                while (this.container.firstChild !== this.container.lastChild) {
                    this.container.removeChild(this.container.firstChild);
                }
            }
        }
        connectedCallback() {
                this.init();
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if (name === "value" && oldVal !== newVal) {
                console.log("value changed");
            }

        }
    }
    window.customElements.define('erddap-server-select', ErddapServerSelect);

    class ErddapDatasetSelect extends HTMLElement {
        static observedAttributes = ["erddap-server","value"];
        constructor() {
            super();
            let shadow = this.attachShadow({mode: 'closed'});
            shadow.appendChild(stylesheet(ss_bootstrap));
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            this._init_erddap_url = null;
            this._init_value = null;
        }

        get value() {
            return this.getAttribute("value");
        }

        set value(value) {
            this.setAttribute("value", value);
        }

        dispatchChangeEvent(){
                this.dispatchEvent(new Event('change',{bubbles: true, composed: true}));
        }

        init() {
            let erddap_url = this.getAttribute("erddap-server");
            let value = this.getAttribute("value");
            if(this._init_erddap_url === erddap_url){
                if(this._init_value !== value){
                    this._init_value = value;
                    this.select.value = value;
                    this.dispatchChangeEvent();
                }
                return;
            }
            this._init_erddap_url = erddap_url;
            this._init_value = value;
             while(this.container.firstChild){
                this.container.removeChild(this.container.firstChild);
            }
            let search_filter = this.getAttribute('dataset-search-filter');
            let erddap = new ErddapClient(erddap_url);
            let fieldset = document.createElement('fieldset');
            fieldset.setAttribute("class", "border p-2");
            let legend = document.createElement('legend');
            legend.setAttribute("class","w-auto");
            legend.innerText = "ERDDAP Dataset";
            fieldset.appendChild(legend);
            let select = document.createElement('select');
            this.select = select;
            select.setAttribute("class","form-control form-control-sm");
            fieldset.appendChild(select);
            let choose = document.createElement('option');
            choose.innerText = "Choose...";
            choose.setAttribute('value','');
            choose.setAttribute('dataset-id','');
            select.appendChild(choose);
            erddap.listDatasets(search_filter).then(datasets => {
                datasets.forEach(dataset => {
                    let option = document.createElement('option');
                    option.setAttribute('value', dataset.url);
                    option.setAttribute('dataset-id', dataset.id);
                    if (value === dataset.id || value === dataset.url) {
                        option.setAttribute('selected', true);
                        select.value = dataset.url;
                    }
                    option.innerText = dataset.id;
                    select.appendChild(option)
                });
            });
            select.addEventListener('change',(e)=>{
                this.value = e.target.value;
                this.dispatchChangeEvent();

            });
            this.container.appendChild(fieldset);
            this.dispatchChangeEvent();
        }
        connectedCallback() {
            this.init();
            setTimeout(()=>this.dispatchChangeEvent(),0)
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if(oldVal !== newVal){
//                if(name === "erddap-server"){
                    this.init();
//                }
            }
        }
    }

    window.customElements.define('erddap-dataset-select', ErddapDatasetSelect);

    class ErddapDatasetInfoTable extends HTMLElement {
        static observedAttributes = ["dataset-url"];
        constructor() {
            super();
            let shadow = this.attachShadow({mode: 'open'});
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            let script = document.createElement("script");
            script.setAttribute("src","https://unpkg.com/leaflet@1.6.0/dist/leaflet.js");
            shadow.appendChild(script);
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
        }

        render() {
            var dataset_url = this.getAttribute("dataset-url");
            while(this.container.firstChild){
                this.container.removeChild(this.container.firstChild);
            }
            if (dataset_url) {
                ErddapClient.fetchDataset(dataset_url).then((dataset) => {
                    let table = document.createElement("table");
                    table.setAttribute("class", "table");
                    this.container.appendChild(table)
                    ErddapTools.metadataTable(dataset,table)
                })
            }
        }
        connectedCallback() {
            this.render();
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if(name === "dataset-url" && oldVal !== newVal){
                this.render();
            }

        }
    }
    window.customElements.define('erddap-dataset-info-table', ErddapDatasetInfoTable);
})();