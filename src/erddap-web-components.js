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

    const ss_fontawesome = "https://use.fontawesome.com/releases/v5.7.2/css/all.css";
    const ss_leaflet = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.css";
    const ss_bootstrap = "https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css";

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
        metadataTable: function(dataset, table) {
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
                mapDiv.setAttribute("id", mapDivId)
                mapDiv.setAttribute("style", "height: " + (spatial.length * 36) + "px;");
                mapCell.appendChild(mapDiv);
                if (typeof(L) !== "undefined") {
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

    function createSearchElements() {
        let div = document.createElement("div");
        let div1 = document.createElement("div");
        div1.setAttribute("class", "container");
        let searchArea = document.createElement("div");
        searchArea.setAttribute("class", "row");
        searchArea.setAttribute("id", "searchArea");
        let div2 = document.createElement("div");
        div2.setAttribute("class", "col-md-12 well");
        let datasets = document.createElement("legend");
        datasets.setAttribute("id", "datasets");
        let a = document.createElement("a");
        a.setAttribute("target", "_blank");
        a.setAttribute("href", "https://coastwatch.pfeg.noaa.gov/erddap/information.html");
        a.setAttribute("title", "find out more...");
        a.appendChild(document.createTextNode("ERDDAP"));
        datasets.appendChild(a)
        datasets.appendChild(document.createTextNode(" Dataset Discovery "));
        let showSettingsLink = document.createElement("a");
        showSettingsLink.setAttribute("href", "#settings");
        showSettingsLink.setAttribute("title", "Click to configure settings");
        showSettingsLink.setAttribute("class", "float-right");
        let i = document.createElement("i");
        i.setAttribute("class", "fa fa-cog");
        showSettingsLink.appendChild(i)
        datasets.appendChild(showSettingsLink)
        div2.appendChild(datasets)
        let testConnections = document.createElement("div");
        testConnections.setAttribute("id", "testConnections");
        testConnections.setAttribute("style", "display: block");
        div2.appendChild(testConnections)
        let searchForm = document.createElement("div");
        searchForm.setAttribute("id", "searchForm");
        searchForm.setAttribute("class", "form-group");
        searchForm.setAttribute("style", "display: none");
        let label = document.createElement("label");
        label.setAttribute("for", "search");
        label.appendChild(document.createTextNode("Search Datasets"));
        searchForm.appendChild(label)
        let search = document.createElement("input");
        search.setAttribute("type", "text");
        search.setAttribute("class", "form-control");
        search.setAttribute("id", "search");
        search.setAttribute("aria-describedby", "searchHelp");
        search.setAttribute("placeholder", "Enter some text...");
        searchForm.appendChild(search)
        let searchHelp = document.createElement("small");
        searchHelp.setAttribute("id", "searchHelp");
        searchHelp.setAttribute("class", "form-text text-muted");
        searchHelp.appendChild(document.createTextNode("Type some words about the dataset you seek, then press the green button"));
        searchForm.appendChild(searchHelp)
        let searchDatasetsButton = document.createElement("button");
        searchDatasetsButton.setAttribute("id", "searchDatasetsButton");
        searchDatasetsButton.setAttribute("class", "btn btn-success");
        searchDatasetsButton.appendChild(document.createTextNode("Search"));
        searchForm.appendChild(searchDatasetsButton)
        let clearButton = document.createElement("button");
        clearButton.setAttribute("id", "clearButton");
        clearButton.setAttribute("class", "btn btn-info");
        clearButton.appendChild(document.createTextNode("Clear"));
        searchForm.appendChild(clearButton)
        div2.appendChild(searchForm)
        let searchInfo = document.createElement("div");
        searchInfo.setAttribute("class", "row");
        searchInfo.setAttribute("id", "searchInfo");
        div2.appendChild(searchInfo)
        let searchResults = document.createElement("div");
        searchResults.setAttribute("class", "row");
        searchResults.setAttribute("id", "searchResults");
        div2.appendChild(searchResults)
        searchArea.appendChild(div2)
        div1.appendChild(searchArea)
        let configurationArea = document.createElement("div");
        configurationArea.setAttribute("class", "row");
        configurationArea.setAttribute("id", "configurationArea");
        configurationArea.setAttribute("style", "display: none");
        let legend = document.createElement("legend");
        let a2 = document.createElement("a");
        a2.setAttribute("target", "_blank");
        a2.setAttribute("href", "https://coastwatch.pfeg.noaa.gov/erddap/information.html");
        a2.setAttribute("title", "find out more...");
        a2.appendChild(document.createTextNode("ERDDAP"));
        legend.appendChild(a2)
        legend.appendChild(document.createTextNode(" Server Settings "));
        let showSearchLink = document.createElement("a");
        showSearchLink.setAttribute("href", "#");
        showSearchLink.setAttribute("title", "Click to hide settings");
        showSearchLink.setAttribute("class", "float-right");
        let i1 = document.createElement("i");
        i1.setAttribute("class", "fa fa-window-close");
        showSearchLink.appendChild(i1)
        legend.appendChild(showSearchLink)
        configurationArea.appendChild(legend)
        let configureErddapServer = document.createElement("div");
        configureErddapServer.setAttribute("id", "configureErddapServer");
        configureErddapServer.setAttribute("class", "form-group");
        let label1 = document.createElement("label");
        label1.setAttribute("for", "filter");
        label1.appendChild(document.createTextNode("Configure Erddap Servers"));
        configureErddapServer.appendChild(label1)
        let filter = document.createElement("input");
        filter.setAttribute("type", "text");
        filter.setAttribute("class", "form-control");
        filter.setAttribute("id", "filter");
        filter.setAttribute("aria-describedby", "filterHelp");
        filter.setAttribute("placeholder", "Enter some text...");
        configureErddapServer.appendChild(filter)
        let filterHelp = document.createElement("small");
        filterHelp.setAttribute("id", "filterHelp");
        filterHelp.setAttribute("class", "form-text text-muted");
        filterHelp.appendChild(document.createTextNode("Type some words to filter in the servers you seek, then press the green button"));
        configureErddapServer.appendChild(filterHelp)
        let filterServersButton = document.createElement("button");
        filterServersButton.setAttribute("id", "filterServersButton");
        filterServersButton.setAttribute("class", "btn btn-success");
        filterServersButton.appendChild(document.createTextNode("Filter"));
        configureErddapServer.appendChild(filterServersButton)
        let clearButton1 = document.createElement("button");
        clearButton1.setAttribute("id", "clearButton");
        clearButton1.setAttribute("class", "btn btn-info");
        clearButton1.appendChild(document.createTextNode("Clear"));
        configureErddapServer.appendChild(clearButton1)
        let addServerButton = document.createElement("button");
        addServerButton.setAttribute("id", "addServerButton");
        addServerButton.setAttribute("class", "btn btn-primary");
        addServerButton.appendChild(document.createTextNode("Add a new server..."));
        configureErddapServer.appendChild(addServerButton)
        configurationArea.appendChild(configureErddapServer)
        let erddapServers = document.createElement("div");
        erddapServers.setAttribute("class", "col-md-12 well");
        erddapServers.setAttribute("id", "erddapServers");
        configurationArea.appendChild(erddapServers)
        div1.appendChild(configurationArea);

        let addServerForm = document.createElement("div");
        addServerForm.setAttribute("class", "row");
        addServerForm.setAttribute("id", "addServerForm");
        addServerForm.setAttribute("style", "display: none");
        let form = document.createElement("form");
        let div3 = document.createElement("div");
        div3.setAttribute("class", "form-group");
        let label2 = document.createElement("label");
        label2.setAttribute("for", "newServerName");
        label2.appendChild(document.createTextNode("Name"));
        div3.appendChild(label2)
        let newServerName = document.createElement("input");
        newServerName.setAttribute("type", "text");
        newServerName.setAttribute("class", "form-control");
        newServerName.setAttribute("id", "newServerName");
        newServerName.setAttribute("placeholder", "My ERRDAP Server");
        div3.appendChild(newServerName)
        let share = document.createElement("small");
        share.setAttribute("id", "share");
        share.setAttribute("class", "form-text text-muted");
        share.appendChild(document.createTextNode("To share your server with others, submit to "));
        let a4 = document.createElement("a");
        a4.setAttribute("target", "_blank");
        a4.setAttribute("title", "opens a new window");
        a4.setAttribute("href", "https://github.com/irishmarineinstitute/awesome-erddap/");
        a4.appendChild(document.createTextNode("awesome erddap"));
        share.appendChild(a4)
        div3.appendChild(share)
        form.appendChild(div3)
        let div4 = document.createElement("div");
        div4.setAttribute("class", "form-group");
        let label3 = document.createElement("label");
        label3.setAttribute("for", "newServerUrl");
        label3.appendChild(document.createTextNode("Url"));
        div4.appendChild(label3)
        let newServerUrl = document.createElement("input");
        newServerUrl.setAttribute("type", "text");
        newServerUrl.setAttribute("class", "form-control");
        newServerUrl.setAttribute("id", "newServerUrl");
        newServerUrl.setAttribute("placeholder", "http://my.erddap.server/erddap/");
        div4.appendChild(newServerUrl)
        let newServerUrlHelpBlock = document.createElement("small");
        newServerUrlHelpBlock.setAttribute("id", "newServerUrlHelpBlock");
        newServerUrlHelpBlock.setAttribute("class", "form-text text-muted");
        div4.appendChild(newServerUrlHelpBlock)
        form.appendChild(div4)
        let div5 = document.createElement("div");
        div5.setAttribute("class", "form-group");
        let addNewServerButtion = document.createElement("button");
        addNewServerButtion.setAttribute("type", "button");
        addNewServerButtion.setAttribute("id", "addNewServerButtion");
        addNewServerButtion.setAttribute("class", "btn btn-success");
        addNewServerButtion.appendChild(document.createTextNode("Save"));
        div5.appendChild(addNewServerButtion)
        let cancelAddNewServerButtion = document.createElement("button");
        cancelAddNewServerButtion.setAttribute("type", "button");
        cancelAddNewServerButtion.setAttribute("id", "cancelAddNewServerButtion");
        cancelAddNewServerButtion.setAttribute("class", "btn btn-info");
        cancelAddNewServerButtion.appendChild(document.createTextNode("Cancel"));
        div5.appendChild(cancelAddNewServerButtion);
        form.appendChild(div5);
        addServerForm.appendChild(form);
        div1.appendChild(addServerForm);
        div.appendChild(div1);

        showSettingsLink.addEventListener("click", () => {
            searchArea.style.display = "none";
            configurationArea.style.display = "block";
        })

        clearButton.addEventListener("click", () => {
            searchResults.innerHTML = "";
        });
        let hideAddServerForm = () => {
            addServerForm.style.display = "none";
            configureErddapServer.style.display = "block";
            erddapServers.style.display = "block";
        }
        showSearchLink.addEventListener("click", () => {
            hideAddServerForm();
            configurationArea.style.display = "none";
            searchArea.style.display = "block";
        });
        cancelAddNewServerButtion.addEventListener("click", hideAddServerForm);

        let filterServers = function() {
            var table = document.getElementById("settingsTable");
            if (table) {
                var filters = document.getElementById("filter").value.split(/\s+/).map(function(t) {
                    return t.toLowerCase();
                });
                var rows = table.rows;
                var n = table.rows.length;
                for (var i = 1; i < n; i++) { //skip header row
                    if (filters.length) {
                        var include = true;
                        var text = rows[i].innerText.toLowerCase();
                        for (var j = 0; j < filters.length; j++) {
                            if (text.indexOf(filters[j]) < 0) {
                                include = false;
                                break;
                            }
                        }
                        rows[i].style.display = include ? "table-row" : "none";
                        rows[i].erddap.visible = include;
                    } else {
                        rows[i].style.display = "table-row";

                    }
                }
            }
        }
        filterServersButton.setAttribute("onclick", "filterServers()");
        clearButton1.setAttribute("onclick", "clearFilterServers()");
        addServerButton.addEventListener("click", () => {
            newServerUrlHelpBlock.innerText = "";
            newServerUrl.value = "";
            newServerName.value = "";
            addServerForm.style.display = "block";
            configureErddapServer.style.display = "none";
            erddapServers.style.display = "none";
            newServerName.focus();
        });

        return {
            container: div,
            testConnections: testConnections,
            searchForm: searchForm,
            searchDatasetsButton: searchDatasetsButton,
            search: search,
            searchResults: searchResults
        };
    }



    function stylesheet(href) {
        let link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", href);
        return link;
    }
    class ErddapWebComponents extends HTMLElement {
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            let slot = document.createElement("slot");
            let container = document.createElement("div");
            container.setAttribute("class", "container");
            container.appendChild(slot);
            shadow.appendChild(container);
            let script = document.createElement("script");
            script.setAttribute("src", "https://unpkg.com/leaflet@1.6.0/dist/leaflet.js");
            shadow.appendChild(script);
        }

    }
    window.customElements.define('erddap-web-components', ErddapWebComponents);

    class ErddapServerSelect extends HTMLElement {
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'closed'
            });

            shadow.appendChild(stylesheet(ss_bootstrap));
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
        }

        get erddaps() {
            return this._erddaps;
        }

        set erddaps(erddaps) {
            this._erddaps = erddaps;
            this.container.innerHTML = "";
            this.init();
        }


        get value() {
            return this.getAttribute("value");
        }

        set value(value) {
            this.setAttribute("value", value);
        }

        init() {
            if (this._erddaps && !this.container.firstChild) {
                let selected_url = this.getAttribute("value");
                let fieldset = document.createElement('fieldset');
                fieldset.setAttribute("class", "border p-2");
                var legend = document.createElement('legend');
                legend.setAttribute("class", "w-auto");
                legend.innerText = "ERDDAP Server";
                fieldset.appendChild(legend);
                let select = document.createElement('select');
                select.setAttribute("class", "form-control form-control-sm");
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
                select.addEventListener('change', (k) => {
                    this.value = k.target.value;
                    this.dispatchEvent(new Event('change', {
                        bubbles: true,
                        composed: true
                    }));
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
            if (this._erddaps) {
                return this.init();
            }
            ErddapClient.fetchAwesomeErddaps().then((items) => {
                if (!this._erddaps) {
                    this._erddaps = items;
                    this.init();
                }
            });
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
        static observedAttributes = ["erddap-server", "value"];
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'closed'
            });
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

        dispatchChangeEvent() {
            this.dispatchEvent(new Event('change', {
                bubbles: true,
                composed: true
            }));
        }

        init() {
            let erddap_url = this.getAttribute("erddap-server");
            let value = this.getAttribute("value");
            if (this._init_erddap_url === erddap_url) {
                if (this._init_value !== value) {
                    this._init_value = value;
                    this.select.value = value;
                    this.dispatchChangeEvent();
                }
                return;
            }
            this._init_erddap_url = erddap_url;
            this._init_value = value;
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
            let search_filter = this.getAttribute('dataset-search-filter');
            let erddap = new ErddapClient({
                url: erddap_url
            });
            let fieldset = document.createElement('fieldset');
            fieldset.setAttribute("class", "border p-2");
            let legend = document.createElement('legend');
            legend.setAttribute("class", "w-auto");
            legend.innerText = "ERDDAP Dataset";
            fieldset.appendChild(legend);
            let select = document.createElement('select');
            this.select = select;
            select.setAttribute("class", "form-control form-control-sm");
            fieldset.appendChild(select);
            let choose = document.createElement('option');
            choose.innerText = "Choose...";
            choose.setAttribute('value', '');
            choose.setAttribute('dataset-id', '');
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
            select.addEventListener('change', (e) => {
                this.value = e.target.value;
                this.dispatchChangeEvent();

            });
            this.container.appendChild(fieldset);
            this.dispatchChangeEvent();
        }
        connectedCallback() {
            this.init();
            setTimeout(() => this.dispatchChangeEvent(), 0)
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if (oldVal !== newVal) {
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
            let shadow = this.attachShadow({
                mode: 'open'
            });
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            let script = document.createElement("script");
            script.setAttribute("src", "https://unpkg.com/leaflet@1.6.0/dist/leaflet.js");
            shadow.appendChild(script);
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
        }

        render() {
            var dataset_url = this.getAttribute("dataset-url");
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
            if (dataset_url) {
                ErddapClient.fetchDataset(dataset_url).then((dataset) => {
                    let table = document.createElement("table");
                    table.setAttribute("class", "table");
                    this.container.appendChild(table)
                    ErddapTools.metadataTable(dataset, table)
                })
            }
        }
        connectedCallback() {
            this.render();
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if (name === "dataset-url" && oldVal !== newVal) {
                this.render();
            }

        }
    }
    window.customElements.define('erddap-dataset-info-table', ErddapDatasetInfoTable);
    class ErddapMultiServerSearch extends HTMLElement {
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            let script = document.createElement("script");
            script.setAttribute("src", "https://unpkg.com/leaflet@1.6.0/dist/leaflet.js");
            shadow.appendChild(script);
            this.elements = createSearchElements();
            this.container = this.elements.container;
            shadow.appendChild(this.container);
            this._erddapConfigs = undefined;
            this.elements.searchDatasetsButton.onclick = () => {
                this.search();
            }
            this.elements.search.onkeydown = (e) => {
                var evt = e || window.event;
                if (evt.keyCode === 13) {
                    this.search();
                }
            };
        }

        search() {
            let hit2tr = function(o) {
                let td = function(text) {
                    let el = document.createElement("td");
                    el.appendChild(document.createTextNode(text));
                    return el;
                }
                let el = document.createElement("tr");
                let expand = td("");
                el.appendChild(expand);
                el.appendChild(td(o.Title));
                el.appendChild(td(o.Institution || ""));
                if (o.Info) {
                    let e = document.createElement("td");
                    let link = document.createElement("a");
                    link.href = o.Info.replace(".json", ".html");
                    link.title = "opens in a new window";
                    link.target = "_blank"
                    let infoLabel = link.href.replace("/index.html", "");
                    let dsname = infoLabel.substring(infoLabel.lastIndexOf("/") + 1);

                    link.appendChild(document.createTextNode(dsname));
                    e.appendChild(link);
                    e.appendChild(document.createElement("br"));
                    e.appendChild(document.createTextNode(link.hostname));
                    el.appendChild(e);
                    expand.innerText = "+";
                    expand.classList.add("btn");
                    expand.classList.add("btn-primary");
                    expand.setAttribute("title","Click to show dataset details");
                    expand.addEventListener("click", e=>{
                        let idx = e.target.parentNode.rowIndex + 1;
                        if (expand.innerText == "-") {
                            table.deleteRow(idx);
                            expand.innerText = "+";
                            return;
                        }
                        let row = table.insertRow(idx);
                        expand.innerText = "-";
                        let contents = td("...");
                        contents.setAttribute("colspan", 4);
                        row.appendChild(contents);
                        ErddapClient.fetchDataset(o.url).then((dataset) => {
                            let infotable = document.createElement("table");
                            infotable.setAttribute("class", "table");
                            contents.innerHTML = "";
                            contents.appendChild(infotable);
                            ErddapTools.metadataTable(dataset, infotable);
                        })

                    });
                }
                return el;

            }
            let onResultsChanged = (x) => {
                //console.log('changed', x)
            };

            let table = document.createElement('table');
            table.setAttribute("class", "table");
            let thead = document.createElement("thead");
            table.appendChild(thead);
            let tr = document.createElement("tr");
            thead.appendChild(tr);
            this.elements.searchResults.appendChild(table);
            let th = function(text) {
                let el = document.createElement("th");
                el.setAttribute('scope', 'col');
                el.appendChild(document.createTextNode(text));
                return el;
            }
            tr.appendChild(th(""));
            tr.appendChild(th("Title"));
            tr.appendChild(th("Institution"));
            tr.appendChild(th("Dataset"));
            let tbody = document.createElement("tbody");
            table.appendChild(tbody);
            let onHit = (hit) => {
                tbody.appendChild(hit2tr(hit));
            }

            this._erddapClients.search(this.elements.search.value, onResultsChanged, onHit);

        }

        testConnections() {
            this.elements.testConnections.style.display = 'block';
            this._erddapClients.testConnect(status => {
                this.elements.testConnections.innerText = `Testing ${status.total} ERDDAP connections, waiting for ${status.remaining}`;
            }).then(() => {
                this.elements.testConnections.style.display = 'none';
                this.elements.searchForm.style.display = 'block';
            })

        }

        set erddaps(configs) {
            this._erddapConfigs = configs;
            this._erddapClients = new ErddapClients(configs);
        }

        connectedCallback() {
            if (this._erddapConfigs) {
                return this.testConnections();
            }
            return ErddapClient.fetchAwesomeErddaps().then(configs => {
                this.erddaps = configs;
                return this.testConnections();
            })
        }
    }
    window.customElements.define('erddap-multi-server-search', ErddapMultiServerSearch);
})();