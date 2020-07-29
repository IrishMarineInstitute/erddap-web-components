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
    const script_src = document.currentScript.getAttribute("src").replace(/[^\/]*$/, "");
    if (typeof(ErddapClient) === 'undefined') {
        console.log("erddap-client.js must be loaded before erddap-web-components.js");
    }

    const ss_fontawesome = "https://use.fontawesome.com/releases/v5.8.2/css/all.css";
    const ss_leaflet = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.css";
    const ss_bootstrap = "https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css";
    //const ss_bootstrap = "https://stackpath.bootstrapcdn.com/bootstrap/5.0.0-alpha1/css/bootstrap.min.css";
    const ss_highlight = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.16.2/build/styles/default.min.css";

    const js_papaparse = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.1.0/papaparse.min.js";
    const js_markdownit = "https://cdn.jsdelivr.net/npm/markdown-it@10.0.0/dist/markdown-it.min.js";
    const js_highlightjs = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.16.2/build/highlight.min.js";
    const js_popper = "https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js";
    const js_leaflet = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.js";

    let mapId = 0;
    let createElement = (name, attrs, text) => {
        let el = document.createElement(name);
        if (attrs) {
            Object.keys(attrs).map(attr => {
                el.setAttribute(attr, attrs[attr]);
            });
        }
        if (text) {
            el.innerText = text;
        }
        return el;
    }
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
                    "Marine Institute": "<i class='fas fa-university'></i> ",
                },
                license: { //TODO: move to config file
                    "Creative Commons Attribution 4.0": "<i class='fas fa-creative-commons'></i> "
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
        },
        fieldsTable: (meta, _type) => {
            let [singular, plural] = {
                "variable": ["Variable", "Variables"],
                "dimension": ["Dimension", "Dimensions"]
            }[_type];
            let div = document.createElement("div");
            div.appendChild(createElement("h2", {}, plural));

            let table = document.createElement("table");
            table.setAttribute("class", "table table-sm");
            let thead = document.createElement("thead");
            let tr = document.createElement("tr");
            tr.appendChild(createElement("th", {}, singular));
            tr.appendChild(createElement("th", {}, "IOOS Category"));
            tr.appendChild(createElement("th", {}, "Type"));
            tr.appendChild(createElement("th", {}, "Comment"));
            thead.appendChild(tr)
            table.appendChild(thead)
            let tbody = document.createElement("tbody");
            var maxlen = [0, 0, 0];
            meta._fieldnames.forEach((fieldname) => {
                if (meta.info[_type][fieldname]) {
                    let v = meta.info[_type][fieldname];
                    let attr = meta.info.attribute[fieldname];
                    let comment = attr.Comment ? attr.Comment.value : (attr.long_name ? attr.long_name.value.indexOf(' ') > 0 ? attr.long_name.value : "" : "");
                    let ioos_category = attr.ioos_category ? attr.ioos_category.value : "";
                    let tr1 = document.createElement("tr");
                    tr1.appendChild(createElement("td", {}, fieldname))
                    tr1.appendChild(createElement("td", {}, ioos_category))
                    tr1.appendChild(createElement("td", {}, v[""].type))
                    tr1.appendChild(createElement("td", {}, comment))
                    tbody.appendChild(tr1)
                }
            });
            table.appendChild(tbody);
            div.appendChild(table);
            return div;
        }
    }



    function createSearchElements(includeExplorerComponents) {
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
        datasets.appendChild(document.createTextNode(` Dataset ${includeExplorerComponents?"Explorer":"Discovery"} `));
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
        searchForm.setAttribute("style", "display: block");
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
        div2.appendChild(searchInfo);
        let categories = false;
        if (includeExplorerComponents) {
            categories = createElement("div", {
                class: "row",
                id: "dataset_filters"
            });
            div2.appendChild(categories);
        }
        let searchResultsContainer = createElement("div", {
            class: "row"
        });

        searchResultsContainer.appendChild(createElement("h5", {}, "Datasets"));
        let table = createElement('table', {
            class: "table table-sm"
        });
        let thead = document.createElement("thead");
        table.appendChild(thead);
        let tr = document.createElement("tr");
        thead.appendChild(tr);

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
        tr.appendChild(th(""));
        let searchResults = document.createElement("tbody");
        table.appendChild(searchResults);
        searchResultsContainer.appendChild(table);

        div2.appendChild(searchResultsContainer)
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

        let filterServers = () => {
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
            container: div1,
            testConnections: testConnections,
            searchForm: searchForm,
            searchDatasetsButton: searchDatasetsButton,
            clearDatasetsButton: clearButton,
            search: search,
            searchResults: searchResults,
            categories: categories
        };
    }
    let formcheckCount = 0;

    function dropdownSelect(shadowRoot, container, name, options, listener) {
        let div_id = `dropdown-${name.replace(/\W/g,'')}`;
        let checkboxes_id = `checkboxes-${div_id}`;
        let div = shadowRoot.getElementById(div_id);
        let checkboxes = shadowRoot.getElementById(checkboxes_id);
        if (checkboxes) {
            while (checkboxes.firstChild) {
                checkboxes.removeChild(checkboxes.firstChild);
            }
        } else {
            div = createElement("div", {
                class: "btn-group",
                id: div_id
            });
            let divlabel = createElement("button", {
                class: "btn btn-secondary dropdown-toggle"
            }, name);
            checkboxes = createElement("div", {
                tabindex: 100 + formcheckCount,
                id: checkboxes_id,
                class: "dropdown-menu",
                style: "position: absolute; transform: translate3d(0px, 38px, 0px); top: 0px; left: 0px; will-change: transform;"
            });
            div.appendChild(divlabel);
            div.appendChild(checkboxes);
            divlabel.addEventListener("click", e => {
                if (checkboxes.classList.contains("show")) {
                    checkboxes.classList.remove("show");
                } else {
                    checkboxes.classList.add("show");
                }
            });
            checkboxes.addEventListener("blur", e => checkboxes.classList.remove("show"));
            container.appendChild(div);
        }

        let keys = Object.keys(options);
        keys.sort();
        keys.map(key => {
            let option = options[key];
            let formcheck = createElement("div", {
                class: "form-check"
            })
            let settings = {
                type: "checkbox",
                value: option.value,
                name: name,
                id: `fc${++formcheckCount}`,
                class: option.state < 0 ? "exclude" : ""
            };
            if (option.state) {
                settings.checked = true;
            }
            let input = createElement("input", settings); //TODO: something more here
            let label = createElement("label", {
                class: "form-check-label",
                for: `fc${formcheckCount}`,
                title: "Click to include/exclude datasets"
            }, key);
            label.addEventListener('click', e => {
                let state = option.state;
                if (input.checked && !input.classList.contains("exclude")) {
                    e.preventDefault();
                    input.classList.add("exclude");
                    label.setAttribute("title", `Datasets with this ${option.class} are excluded`);
                    option.state = -1;
                } else {
                    if (input.checked) {
                        input.classList.remove("exclude");
                        label.setAttribute("title", "Click to include/exclude datasets");
                        option.state = 0;
                    } else {
                        label.setAttribute("title", `Datasets without this ${option.class} are excluded`);
                        state = "include"
                        option.state = 1;
                    }
                }
                if (listener) {
                    setTimeout(() => {
                        listener(option)
                    }, 0)
                }
            })
            formcheck.appendChild(input);
            formcheck.appendChild(document.createTextNode(" "));
            formcheck.appendChild(label);
            checkboxes.appendChild(formcheck);
        });

        return div;

    }


    function stylesheet(href) {
        let link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", href);
        link.setAttribute("crossorigin", "anonymous")
        return link;
    }
    ShadowRoot.prototype.appendChildScript = function(src, inline) {
        return new Promise((resolve, reject) => {
            let el = document.createElement("script");
            if (inline) {
                el.textContent = src;
            } else {
                el.setAttribute("src", src);
            }
            el.onload = resolve;
            el.onerror = reject;
            this.appendChild(el);
        })
    }
    ShadowRoot.prototype.appendChildScripts = function(scripts) {
        let promises = scripts.map(src => this.appendChildScript(src));
        return Promise.all(promises);
    }

    Element.prototype.activateTabs = function() {
        let navlinks = this.querySelectorAll("ul.nav > li.nav-item > a.nav-link");
        Object.keys(navlinks).map((tab) => {
            navlinks[tab].addEventListener("click", (e) => {
                let targetTab = e.currentTarget;
                let tabs = targetTab.closest('ul').querySelectorAll("li.nav-item > a.nav-link");
                let targetPane = targetTab.closest('div.tab-pane').querySelector(targetTab.getAttribute("href"));
                if (!targetPane) {
                    console.log(`did not find href ${targetTab.getAttribute("href")} for targetTab from div.tab_pane`, targetTab, targetTab.closest('div.tab-pane'))
                }
                //deactivate the panes
                let pane = firstSibling(targetPane);
                while (pane) {
                    ["active", "show"].map(cl => pane.classList.remove(cl));
                    pane = pane.nextElementSibling;
                }
                //deactivate the tabs
                Object.keys(tabs).map((item) => {
                    ["active", "show"].map(cl => tabs[item].classList.remove(cl));
                });
                //activate target pane and tab
                ["active", "show"].map(cl => targetTab.classList.add(cl));
                ["active", "show"].map(cl => targetPane.classList.add(cl));
                e.preventDefault();
            });
        });

        function firstSibling(e) {
            while (e.previousElementSibling) {
                e = e.previousElementSibling;
            }
            return e;

        }
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
            //container.setAttribute("class", "container");
            container.appendChild(slot);
            shadow.appendChild(container);
            shadow.appendChildScript(js_leaflet);
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
                //console.log("value changed");
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
            shadow.appendChildScript(js_leaflet);
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            this.rendered = false;
        }

        render() {
            var dataset_url = this.getAttribute("dataset-url");
            if (dataset_url && dataset_url !== this.rendered) {
                this.rendered = dataset_url;
                while (this.container.firstChild) {
                    this.container.removeChild(this.container.firstChild);
                }
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

    class ErddapDatasetFieldsTable extends HTMLElement {
        static observedAttributes = ["dataset-url"];

        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            shadow.appendChild(stylesheet(ss_bootstrap));
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            this.rendered = false;
        }
        render() {
            var dataset_url = this.getAttribute("dataset-url");
            if (dataset_url && dataset_url !== this.rendered) {
                this.rendered = dataset_url;
                while (this.container.firstChild) {
                    this.container.removeChild(this.container.firstChild);
                }
                ErddapClient.fetchDataset(dataset_url).then((dataset) => {
                    if (dataset.dimensions) {
                        this.container.appendChild(ErddapTools.fieldsTable(dataset, "dimension"))
                    }
                    this.container.appendChild(ErddapTools.fieldsTable(dataset, "variable"))
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
    window.customElements.define('erddap-dataset-fields-table', ErddapDatasetFieldsTable);
    class ErddapMultiServerSearch extends HTMLElement {
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_leaflet));
            shadow.appendChild(stylesheet(ss_bootstrap));
            shadow.appendChildScript(js_leaflet);
            this.shadow = shadow;
            if (typeof(ErddapExplorer) !== 'undefined') {
                let style = document.createElement("style");
                style.setAttribute("type", "text/css");
                style.innerText = `
                    input[type=checkbox] { display:none; } /* to hide the checkbox itself */
                    input[type=checkbox] + label:before {
                      font-family: "Font Awesome 5 Free";
                      display: inline-block;
                          font-style: normal;
                        font-weight: normal;
                    }

                    input[type=checkbox] + label:before { content: "\\f111"; } /* unchecked icon */
                    input[type=checkbox]:checked + label:before { content: "\\f058"; } /* checked icon */
                    input[type=checkbox].exclude:checked + label:before { content: "\\f057"; } /* checked icon */
            `;
                shadow.appendChild(style);

                this.explorer = new ErddapExplorer();
                this.explorer.app_data.dropdowns = {};
                this.explorer.on("categoriesChanged", (categories) => {
                    // hide dropdowns for any unused categories.
                    Object.keys(this.explorer.app_data.dropdowns).forEach(category => {
                        if (!categories[category]) {
                            this.explorer.app_data.dropdowns[category].style.display = "none";
                        }
                    })

                    let container = shadow.getElementById("dataset_filters");
                    dropdownSelect(shadow, container, "IOOS Category",
                        categories, (category) => {
                            let variables = category.variables.reduce(function(map, variable) {
                                map[variable.value] = variable;
                                return map;
                            }, {});
                            let variablesDropdown = dropdownSelect(shadow, container, category.value, variables, (variable) => {
                                filterDatasetResults(Object.values(categories));
                            });
                            this.explorer.app_data.dropdowns[category.value] = variablesDropdown;
                            variablesDropdown.style.display = category.state === 1 ? "" : "none";
                            filterDatasetResults(Object.values(categories));

                        });
                });
            }

            this.elements = createSearchElements(this.explorer ? true : false);
            this.container = this.elements.container;
            shadow.appendChild(this.container);
            let filterDatasetResults = (categories) => {
                let rows = this.elements.searchResults.closest("table").rows;
                for (let row = 1; row < rows.length; row++) {
                    let dataset_url = rows[row].getAttribute("dataset-url");
                    let display = "table-row";
                    for (let i = 0; i < categories.length; i++) {
                        let category = categories[i];
                        if (!category.state) continue;
                        if (category.state < 0) { // exclude only these
                            if (category.dataset_urls.indexOf(dataset_url) >= 0) {
                                display = "none";
                                break;
                            }
                        } else { // include only datasets with these
                            if (category.dataset_urls.indexOf(dataset_url) < 0) {
                                display = "none";
                                break;
                            }
                            // were any specific variables included/excluded
                            category.variables.map(variable => {
                                if (!variable.state) return;
                                if (variable.state < 0) { // these to be excluded
                                    if (variable.dataset_urls.indexOf(dataset_url) >= 0) {
                                        display = "none";
                                        return;
                                    }

                                } else { // these must be included
                                    if (variable.dataset_urls.indexOf(dataset_url) < 0) {
                                        display = "none";
                                        return;
                                    }
                                }
                            });
                        }
                        if (display === "none") {
                            break;
                        }

                    }
                    //TODO: use css class instead
                    rows[row].style.display = display;

                }
            }
            this._erddapConfigs = undefined;
            this.elements.searchDatasetsButton.onclick = () => {
                this.search();
            }
            this.elements.clearDatasetsButton.onclick = () => {
                this.elements.search.value = "";
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
            [this.elements.searchResults].map(el => {
                while (el.firstChild) {
                    el.removeChild(el.firstChild);
                }
            });
            [this.shadow.getElementById("dataset_filters")].map(el => {
                while (el.firstChild !== el.lastChild) {
                    el.removeChild(el.lastChild);
                }
            });
            if(this.explorer){
                this.explorer.clear();
            }

            let searchQuery = this.elements.search.value || (this.explorer ? "time" : "");
            if (!searchQuery.length) {
                return;
            }


            let hit2tr = o => {
                let td = function(text) {
                    let el = document.createElement("td");
                    el.appendChild(document.createTextNode(text));
                    return el;
                }
                let tr = createElement("tr", {
                    class: "dataset",
                    "dataset-url": o.Info
                });
                let expand = td("");
                tr.appendChild(expand);
                tr.appendChild(td(o.Title));
                tr.appendChild(td(o.Institution || ""));
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
                    tr.appendChild(e);
                    expand.classList.add("btn");
                    expand.classList.add(this.explorer ? "btn-outline-info" : "btn-info");
                    let expandText = document.createTextNode("+");
                    expand.appendChild(expandText);
                    expand.setAttribute("title", "Click to show dataset details");
                    expand.addEventListener("click", e => {
                        let idx = e.target.parentNode.rowIndex + 1;
                        if (tr.expanded) {
                            table.deleteRow(idx);
                            tr.expanded = false;
                            expandText.innerText = "+";
                            return;
                        }
                        let row = table.insertRow(idx);
                        tr.expanded = true;
                        expandText.innerText = "-";
                        let contents = td(""); //"...");
                        contents.setAttribute("colspan", 4);
                        row.appendChild(contents);
                        //let infotable = document.createElement('erddap-dataset-info-table');
                        //infotable.setAttribute("dataset-url", o.url);
                        //contents.appendChild(infotable);
                        let tabs = document.createElement('erddap-dataset-tabs');
                        tabs.setAttribute("dataset-url", o.url);
                        contents.appendChild(tabs);
                        e.preventDefault();

                    });
                    if (this.explorer) {
                        ErddapClient.politeFetchJsonp(o.Info).then(data => {
                            expand.classList.remove("btn-outline-info");
                            expand.classList.add("btn-info");
                        });
                        this.explorer.addDataset(o.Info);
                    }
                }
                if (this.explorer) {
                    let trash = createElement("span", {
                        class: "fa fa-trash"
                    });
                    let trashtd = createElement("td", {
                        class: "btn btn-light"
                    });
                    trashtd.addEventListener("click", e => {
                        if (tr.expanded) {
                            table.deleteRow(tr.rowIndex + 1);
                        }
                        this.explorer.removeDataset(o.Info);
                        table.deleteRow(tr.rowIndex);
                    })
                    trashtd.appendChild(trash);
                    tr.appendChild(trashtd);
                }
                return tr;

            }
            let onResultsChanged = (x) => {
                //console.log('changed', x)
            };
            let tbody = this.elements.searchResults;
            let table = tbody.closest("table");
            let onHit = (hit) => {
                tbody.appendChild(hit2tr(hit));
            }
            this._erddapClients.search({
                query: searchQuery,
                onResultStatusChanged: onResultsChanged,
                onHit: onHit
            });

        }

        testConnections() {
            this.elements.testConnections.style.display = 'block';
            this._erddapClients.testConnect(status => {
                this.elements.testConnections.innerText = `Testing ${status.total} ERDDAP connections, waiting for ${status.remaining}`;
            }).then(() => {
                this.elements.testConnections.style.display = 'none';
                this.search();
            })

        }

        set erddaps(configs) {
            this._erddapConfigs = configs;
            this._erddapClients = new ErddapClients(configs);
        }

        connectedCallback() {
            // wait until children parsed...
            setTimeout(() => this._configureErddapClients())
        }
        _configureErddapClients() {
            if (this._erddapConfigs) {
                return this.testConnections();
            }
            if (this.getElementsByTagName("option").length) {
                let options = this.getElementsByTagName("option");
                let erddapConfigs = [];
                for (let option of options) {
                    erddapConfigs.push({
                        name: option.text,
                        short_name: option.text,
                        url: option.value,
                        public: true
                    })
                }
                this.erddaps = erddapConfigs;
                return this.testConnections();
            }
            return ErddapClient.fetchAwesomeErddaps().then(configs => {
                this.erddaps = configs;
                return this.testConnections();
            })
        }
    }
    window.customElements.define('erddap-multi-server-search', ErddapMultiServerSearch);

    class ErddapDatasetAPI extends HTMLElement {
        static observedAttributes = ["dataset-url"];
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            this.shadow = shadow;
            shadow.appendChild(stylesheet(ss_fontawesome));
            shadow.appendChild(stylesheet(ss_bootstrap));
            shadow.appendChild(stylesheet(ss_highlight));
            let style = document.createElement("style");
            style.setAttribute("type", "text/css");
            style.innerText = `
            pre.hljs {
                overflow: auto;
            }
            `;
            shadow.appendChild(style);
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            this.rendered = false;

            let scripts = [js_papaparse, js_markdownit, js_highlightjs, js_popper, `${script_src}zapidox.js?2020-07-20`];
            shadow.appendChildScripts(scripts).then(() => this.render());

        }

        render() {
            if (this.rendered) {
                return;
            }
            if (typeof(Zapidox) === "undefined") {
                return;
            }
            var dataset_url = this.getAttribute("dataset-url");
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
            if (dataset_url) {
                this.container.innerHTML = "<p class='lead'>loading developer documentation</p>";
                Zapidox.generate(dataset_url).then(apidox => {
                    while (this.container.firstChild) {
                        this.container.removeChild(this.container.firstChild);
                    }
                    this.container.append(apidox);
                    apidox.activateTabs();
                });
                this.rendered = true;
            }
        }
        connectedCallback() {
            this.render();
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if (name === "dataset-url" && oldVal !== newVal) {
                this.rendered = false;
                this.render();
            }

        }
    }
    window.customElements.define('erddap-dataset-api', ErddapDatasetAPI);
    /**
     * Tabs to switch between general view and developer view (zapidox)
     */
    class ErddapDatasetTabs extends HTMLElement {
        static observedAttributes = ["dataset-url"];
        constructor() {
            super();
            let shadow = this.attachShadow({
                mode: 'open'
            });
            this.shadow = shadow;
            shadow.appendChild(stylesheet(ss_bootstrap));
            this.container = document.createElement("div");
            shadow.appendChild(this.container);
            this.rendered = false;
        }

        render() {
            if (this.rendered) {
                return;
            }
            var dataset_url = this.getAttribute("dataset-url");
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
            if (dataset_url) {
                this.rendered = true;
                let el = this.createErddapDatasetTabsElement(dataset_url);
                el.activateTabs();
                this.container.append(el);
            }
        }
        connectedCallback() {
            this.render();
        }

        disconnectedCallback() {}

        attributeChangedCallback(name, oldVal, newVal) {
            if (name === "dataset-url" && oldVal !== newVal) {
                this.rendered = false;
                this.render();
            }

        }

        createErddapDatasetTabsElement(dataset_url) {
            let link = dataset_url.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/[-]+/g, '-');
            let div = createElement("div", {
                "class": "tab-pane container"
            });
            let ul = createElement("ul", {
                "class": "nav nav-tabs",
                "role": "tablist"
            });
            let tabs = [{
                name: "Info",
                active: true,
                element: "erddap-dataset-info-table"
            }, {
                name: "Fields",
                element: "erddap-dataset-fields-table"

            }, {
                name: "API",
                element: "erddap-dataset-api"
            }];
            tabs.map(tab => {
                let li = createElement("li", {
                    "class": "nav-item",
                    "role": "presentation"
                });

                let a = createElement("a", {
                    "class": "nav-link" + (tab.active ? " active" : ""),
                    "data-toggle": "tab",
                    "href": `#${link}-${tab.name.toLowerCase()}`,
                    "role": "tab",
                    "aria-controls": `${tab.name.toLowerCase()}`,
                    "aria-selected": tab.active ? "true" : "false"
                }, tab.name);
                li.appendChild(a)
                ul.appendChild(li)

            });
            div.appendChild(ul)
            let datasetContent = createElement("div", {
                "class": "tab-content",
                "id": "datasetContent"
            });
            tabs.map(tab => {
                let tabpane = createElement("div", {
                    "class": "tab-pane fade" + (tab.active ? " active show" : ""),
                    "id": `${link}-${tab.name.toLowerCase()}`,
                    "role": "tabpanel",
                    "aria-labelledby": `${tab.name.toLowerCase()}-tab`
                });
                let element = createElement(tab.element, {
                    "dataset-url": dataset_url
                });
                tabpane.appendChild(element)
                datasetContent.appendChild(tabpane)
            });

            div.appendChild(datasetContent)
            return div;
        }
    }
    window.customElements.define('erddap-dataset-tabs', ErddapDatasetTabs);
})();