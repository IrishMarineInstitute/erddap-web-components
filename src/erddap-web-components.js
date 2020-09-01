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
    const ss_leaflet_draw = "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.min.css";

    const js_papaparse = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.1.0/papaparse.min.js";
    const js_markdownit = "https://cdn.jsdelivr.net/npm/markdown-it@10.0.0/dist/markdown-it.min.js";
    const js_highlightjs = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.16.2/build/highlight.min.js";
    const js_popper = "https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js";
    const js_leaflet = "https://unpkg.com/leaflet@1.6.0/dist/leaflet.js";
    const js_leaflet_draw = "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.min.js";

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



    function createSearchElements(explorer) {
        let div1 = createElement("div", {
            class: "container-fluid"
        });
        let searchArea = createElement("div", {
            class: "row",
            id: "searchArea"
        });
        let categories = createElement("div", {
            class: "col-2",
            id: "dataset_filters"
        });
        searchArea.appendChild(categories);

        let div2 = createElement("div", {
            class: "col-8 well"
        });
        searchArea.appendChild(div2);

        let rightColumn = createElement("div",{
            class: "col-2"
        });
        searchArea.appendChild(rightColumn);

        let datasets = createElement("legend", {
            id: "datasets"
        });
        let a = createElement("a", {
            target: "_blank",
            href: "https://coastwatch.pfeg.noaa.gov/erddap/information.html",
            title: "find out more..."
        }, "ERDDAP");
        datasets.appendChild(a)
        datasets.appendChild(document.createTextNode(` Dataset ${explorer?"Explorer":"Discovery"} `));
        let showSettingsLink = createElement("a", {
            href: "#settings",
            title: "Click to configure settings",
            class: "float-right"
        });
        let i = document.createElement("i");
        i.setAttribute("class", "fa fa-cog");
        showSettingsLink.appendChild(i)
        datasets.appendChild(showSettingsLink)
        div2.appendChild(datasets)
        let testConnections = document.createElement("div",{
            id: "testConnections",
            style: "display: block"
        });
        div2.appendChild(testConnections)
        let searchForm = createElement("div", {
            id: "searchForm",
            class: explorer ? "form-inline" : "form-group",
            style: "display: block"
        });
        let search = createElement("input", {
            type: "text",
            class: "form-control",
            id: "search",
            "aria-describedby": "searchHelp",
            placeholder: "Full text search..."
        });
        searchForm.appendChild(search)
        let searchDatasetsButton = createElement("button", {
            id: "searchDatasetsButton",
            class: "btn btn-success"
        }, "Search");
        searchForm.appendChild(searchDatasetsButton)
        let clearButton = createElement("button", {
            id: "clearButton",
            class: "btn btn-info"
        }, "Clear");
        searchForm.appendChild(clearButton)
        div2.appendChild(searchForm)
        let searchInfo = createElement("div", {
            "class": "row",
            id: "searchInfo"
        });
        div2.appendChild(searchInfo);
        let mapcomponents = {};
        if (explorer) {


            let mapDiv = createElement('div', {
                id: "explorerMap",
                style: "height: 300px;"
            });
            div2.appendChild(mapDiv);
            let loadMapAttempts = 100;
            let loadMap = () => {
                if (typeof(L) === "undefined") {
                    if (--loadMapAttempts > 0) {
                        setTimeout(loadMap, 200);
                    } else {
                        console.log("giving up waiting for leaflet to load. No map will be shown.")
                    }
                    return;
                }
                var map = L.map(mapDiv, {
                    attributionControl: false
                }).setView([0, 0], 1);
                L.control.attribution({
                    position: "bottomleft"
                }).addTo(map);
                L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
                let boundsLayer = L.layerGroup().addTo(map);;
                mapcomponents.boundsLayer = boundsLayer;
                let loadDrawControlAttempts = 100;
                let loadDrawControl = () => {
                    if (typeof(L.Control.Draw) === "undefined") {
                        if (--loadDrawControlAttempts > 0) {
                            setTimeout(loadDrawControl, 200);
                        } else {
                            console.log("giving up waiting for leaflet to load. No draw control will be shown.")
                        }
                        return;
                    }
                    var drawnItems = new L.FeatureGroup();
                    map.addLayer(drawnItems);
                    L.drawLocal.draw.toolbar.buttons.rectangle = "Mark area of interest";
                    L.drawLocal.edit.toolbar.buttons.edit = "Edit area of interest";
                    L.drawLocal.edit.toolbar.buttons.editDisabled = "No area of interest to edit";
                    L.drawLocal.edit.toolbar.buttons.remove = "Remove area of interest";
                    L.drawLocal.edit.toolbar.buttons.removeDisabled = "No area of interest to remove";
                    L.drawLocal.draw.handlers.rectangle.tooltip.start = "Click and drag to mark area of interest"
                    L.EditToolbar.Delete.include({
                        enable: function() {
                            drawnItems.clearLayers();
                            explorer.setBounds();
                        }
                    })
                    let drawControl = new L.Control.Draw({
                        draw: {
                            polyline: false,
                            polygon: false,
                            marker: false,
                            circle: false,
                            circlemarker: false
                        },
                        edit: {
                            featureGroup: drawnItems,
                            edit: false
                        }

                    });
                    map.addControl(drawControl);
                    map.on(L.Draw.Event.CREATED, function(event) {
                        drawnItems.clearLayers();
                        let polygon = L.polygon([
                            [
                                [90, -18000],
                                [90, 18000],
                                [-90, 18000],
                                [-90, -18000]
                            ],
                            event.layer.getLatLngs()
                        ])
                        drawnItems.addLayer(polygon);
                        let bounds = event.layer.getBounds();
                        map.fitBounds(bounds)
                        explorer.setBounds(bounds);
                    });

                }
                setTimeout(loadDrawControl, 100);


            }
            setTimeout(loadMap, 200);

            { //elevation control
                let elevationsControl = createElement("div",{
                    style: "margin-top: 80px"
                });
                let elevationLabel0 = createElement("h5",{},"Elevation")
                let elevationLabel1 = createElement("h5")
                let elevationLabel2 = createElement("h5")
                let sectionHolder = createElement("div")
                let section = createElement("section", {
                    class: "range-slider",
                    style: "width: 200px; transform-origin: 100px 100px; transform: rotate(-90deg)"
                });
                let elevationsSlider1 = createElement("input", {
                    type: "range",
                    value: 0,
                    max: 1000,
                    class: "form-control-rangex",
                    id: "elevationsSlider1"
                });
                let elevationsSlider2 = createElement("input", {
                    type: "range",
                    value: 1000,
                    max: 1000,
                    class: "form-control-rangex",
                    id: "elevationsSlider2"
                });
                section.appendChild(elevationsSlider1);
                section.appendChild(elevationsSlider2);
                sectionHolder.appendChild(section);
                sectionHolder.appendChild(createElement("div",{
                    style: "height: 200px; z-index: -1"
                }))
                elevationsControl.appendChild(elevationLabel0);
                elevationsControl.appendChild(elevationLabel2);
                elevationsControl.appendChild(sectionHolder);
                elevationsControl.appendChild(elevationLabel1);
                rightColumn.appendChild(elevationsControl);

                explorer.on("datasetsIndexLoaded", (datasetsIndex) => {
                    elevationsSlider1.setAttribute("max", datasetsIndex.elevation.max);
                    elevationsSlider2.setAttribute("max", datasetsIndex.elevation.max);
                    elevationsSlider1.setAttribute("min", datasetsIndex.elevation.min);
                    elevationsSlider2.setAttribute("min", datasetsIndex.elevation.min);
                    elevationsSlider1.setAttribute("value", datasetsIndex.elevation.min);
                    elevationLabel1.innerText = `${datasetsIndex.elevation.min}m`;
                    elevationsSlider2.setAttribute("value", datasetsIndex.elevation.max);
                    elevationLabel2.innerText = `${datasetsIndex.elevation.max}m`;
                    let listener = () => {
                        let elevations = [parseInt(elevationsSlider1.value), parseInt(elevationsSlider2.value)];
                        elevations.sort((a,b)=>a-b);
                        elevationLabel1.innerText = `${elevations[0]}m`;
                        elevationLabel2.innerText = `${elevations[1]}m`;
                        explorer.setElevations({min:elevations[0], max:elevations[1]});
                    }
                    elevationsSlider1.addEventListener("input", listener);
                    elevationsSlider2.addEventListener("input", listener);
                });

            }

            {
                let yearsControl = createElement("div", {
                    class: "row"
                });
                let yearLabel1 = createElement("div", {
                    class: "h5 col-md-1"
                })
                let yearLabel2 = createElement("div", {
                    class: "h5 col-md-1"
                })
                let sectionHolder = createElement("div", {
                    class: "col-md-10"
                })
                let section = createElement("section", {
                    class: "range-slider"
                });
                let yearsSlider1 = createElement("input", {
                    type: "range",
                    value: 0,
                    max: 100,
                    class: "form-control-rangex",
                    id: "yearsSlider1"
                });
                let yearsSlider2 = createElement("input", {
                    type: "range",
                    value: 100,
                    max: 100,
                    class: "form-control-rangex",
                    id: "yearsSlider2"
                });
                section.appendChild(yearsSlider1);
                section.appendChild(yearsSlider2);
                sectionHolder.appendChild(section);
                yearsControl.appendChild(yearLabel1);
                yearsControl.appendChild(sectionHolder);
                yearsControl.appendChild(yearLabel2);
                div2.appendChild(yearsControl);


                let years = [];
                explorer.on("datasetsIndexLoaded", (datasetsIndex) => {
                    years = explorer.years.map((year) => {
                        year.state = 1;
                        return year.value;
                    });
                    yearsSlider1.setAttribute("max", years.length - 1);
                    yearsSlider2.setAttribute("max", years.length - 1);
                    yearsSlider1.setAttribute("value", 0);
                    yearLabel1.innerText = years[0];
                    yearsSlider2.setAttribute("value", years.length - 1);
                    yearLabel2.innerText = years[years.length - 1];
                    let listener = () => {
                        let yrs = [years[yearsSlider1.value], years[yearsSlider2.value]];
                        yrs.sort();
                        yearLabel1.innerText = yrs[0];
                        yearLabel2.innerText = yrs[1];
                        explorer.years.map((year) => {
                            year.state = (year.value >= yrs[0] && year.value <= yrs[1]) ? 1 : 0;
                        });

                        explorer._trigger("selectedYearsChanged");
                    }
                    yearsSlider1.addEventListener("input", listener);
                    yearsSlider2.addEventListener("input", listener);
                });

            }



        }

        let searchResultsContainer = createElement("div", {
            class: "row"
        });
        let searchResultsLabel = createElement("h5", {}, "Datasets");
        searchResultsContainer.appendChild(searchResultsLabel);
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
        tr.appendChild(th(explorer?"Years":""));
        tr.appendChild(th("Institution"));
        tr.appendChild(th("Dataset"));
        tr.appendChild(th(""));
        let searchResults = document.createElement("tbody");
        table.appendChild(searchResults);
        searchResultsContainer.appendChild(table);

        div2.appendChild(searchResultsContainer)


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
            searchResultsLabel: searchResultsLabel,
            categories: categories,
            mapcomponents: mapcomponents
        };
    }
    let formcheckCount = 0;

    function dropdownSelect(shadowRoot, container, threeway, allSelector, name, options, listener) {
        let div_id = `dropdown-${name.replace(/\W/g,'')}`;
        let checkboxes_id = `checkboxes-${div_id}`;
        let div = shadowRoot.getElementById(div_id);
        let checkboxes = shadowRoot.getElementById(checkboxes_id);
        if (checkboxes) {
            while (checkboxes.lastChild && !checkboxes.lastChild.sticky) {
                checkboxes.removeChild(checkboxes.lastChild);
            }
        } else {
            div = createElement("div", {
                class: "card text-white bg-info mt-1",
                id: div_id
            });
            let divlabel = createElement("h6", {
                class: "card-title dropdown-toggle"
            }, name);
            checkboxes = createElement("div", {
                tabindex: 100 + formcheckCount,
                id: checkboxes_id

            });
            div.appendChild(divlabel);
            div.appendChild(checkboxes);
            let showElements = () => {
                let inputs = checkboxes.getElementsByTagName("input");
                for (let input of inputs) {
                    input.closest("div.form-check").style.display = "block";
                }
            }
            let hideElements = () => {
                let inputs = checkboxes.getElementsByTagName("input");
                for (let input of inputs) {
                    if (!input.checked) {
                        input.closest("div.form-check").style.display = "none";
                    }
                }
            }
            checkboxes.hideElements = hideElements;
            divlabel.addEventListener("mousedown", e => {
                if (checkboxes.classList.contains("show")) {
                    checkboxes.classList.remove("show");
                    hideElements();
                } else {
                    checkboxes.classList.add("show");
                    showElements();
                }
            });
            checkboxes.addEventListener("blur", e => {
                checkboxes.classList.remove("show");
                hideElements();
            });
            container.appendChild(div);
        }
        if (allSelector) {
            div.mode = "any";
            [{
                mode: "any",
                text: `Datasets with any selected ${name}`,
                checked: true
            }, {
                mode: "all",
                text: `Datasets with every selected ${name}`
            }].map(el => {
                let formcheck = createElement("div", {
                    class: "form-check"
                })
                formcheck.style["padding-left"] = ".1rem"
                let label = createElement("label", {
                    class: "form-check-label",
                    for: `mode{$name}${el.mode}`
                }, el.text);
                let input = createElement("input", {
                    type: "radio",
                    class: "form-check-input",
                    name: `mode${name}`,
                    id: `mode{$name}${el.mode}`,
                    value: el.mode
                })
                input.addEventListener('change', function() {
                    if (this.checked) {
                        div.mode = el.mode;
                        if (listener) {
                            setTimeout(listener, 0);
                        }
                    }
                })
                if (el.checked) {
                    input.setAttribute("checked", true);
                }
                formcheck.appendChild(input);
                formcheck.appendChild(label);
                checkboxes.appendChild(formcheck);
                formcheck.sticky = true;
            });

            { // select/unselect all.
                let option = {
                    state: 0
                }
                let formcheck = createElement("div", {
                    class: "form-check"
                })
                formcheck.style["padding-left"] = ".1rem"
                let settings = {
                    type: "checkbox",
                    value: option.value,
                    name: name,
                    id: `fc${++formcheckCount}`,
                    class: option.state < 0 ? "exclude" : "",
                    checked: true
                };
                let input = createElement("input", settings); //TODO: something more here
                let label = createElement("label", {
                    class: "form-check-label",
                    for: `fc${formcheckCount}`,
                    title: "Select/unselect all"
                }, "Select all");
                label.addEventListener('click', e => {
                    let state = option.state;
                    if (threeway && input.checked && !input.classList.contains("exclude")) {
                        e.preventDefault();
                        input.classList.add("exclude");
                        option.state = -1;
                    } else {
                        if (input.checked) {
                            input.classList.remove("exclude");
                            option.state = 0;
                        } else {
                            state = "include"
                            option.state = 1;
                        }
                    }
                    Object.values(options).map(o => {
                        if (o.state !== option.state) {
                            o.state = option.state;
                            switch (o.state) {
                                case -1:
                                    o.input.classList.add("exclude");
                                    o.input.checked = true;
                                    o.label.setAttribute("title", `Datasets with this ${o.class} are excluded`);
                                    break;
                                case 0:
                                    o.input.classList.remove("exclude");
                                    o.input.checked = false;
                                    o.label.setAttribute("title", "Click to filter datasets");
                                    break;
                                case 1:
                                    o.input.classList.remove("exclude");
                                    o.input.checked = true;
                                    o.label.setAttribute("title", `Datasets with${threeway?"out":""} this ${o.class} are ${threeway?"ex":"in"}cluded`);
                                    break;
                                default:
                                    throw `unexpected state ${o.state}`

                            }
                        }
                    })
                    if (listener) {
                        setTimeout(listener, 0);
                    }

                })
                formcheck.appendChild(input);
                formcheck.appendChild(document.createTextNode(" "));
                formcheck.appendChild(label);
                checkboxes.appendChild(formcheck);
            }
        }

        let keys = Object.keys(options);
        keys.sort();
        keys.map(key => {
            let option = options[key];
            let formcheck = createElement("div", {
                class: "form-check"
            })
            formcheck.style["padding-left"] = ".1rem"
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
                title: "Click to filter datasets"
            }, key);
            option.input = input;
            option.label = label;
            label.addEventListener('click', e => {
                let state = option.state;
                if (threeway && input.checked && !input.classList.contains("exclude")) {
                    e.preventDefault();
                    input.classList.add("exclude");
                    label.setAttribute("title", `Datasets with this ${option.class} are excluded`);
                    option.state = -1;
                } else {
                    if (input.checked) {
                        input.classList.remove("exclude");
                        label.setAttribute("title", "Click to filter datasets");
                        option.state = 0;
                    } else {
                        label.setAttribute("title", `Datasets with${threeway?"out":""} this ${option.class} are ${threeway?"ex":"in"}cluded`);
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
        checkboxes.hideElements();

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
                shadow.appendChild(stylesheet(ss_leaflet_draw))
                shadow.appendChildScript(js_leaflet).then(x => shadow.appendChildScript(js_leaflet_draw))
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



                    section.range-slider {
                      width: 100%;
                      margin: auto;
                      text-align: center;
                      position: relative;
                      height: 1em;
                    }

                    section.range-slider input[type=range] {
                      position: absolute;
                      left: 0;
                      bottom: 0;
                    }

                    section input[type=range] {
                      -webkit-appearance: none;
                      width: 100%;
                    }

                    section input[type=range]:focus {
                      outline: none;
                    }

                    section input[type=range]:focus::-webkit-slider-runnable-track {
                      background: #2497e3;
                    }

                    section input[type=range]:focus::-ms-fill-lower {
                      background: #2497e3;
                    }

                    section input[type=range]:focus::-ms-fill-upper {
                      background: #2497e3;
                    }

                    section input[type=range]::-webkit-slider-runnable-track {
                      width: 100%;
                      height: 5px;
                      cursor: pointer;
                      animate: 0.2s;
                      background: #2497e3;
                      border-radius: 1px;
                      box-shadow: none;
                      border: 0;
                    }

                    section input[type=range]::-webkit-slider-thumb {
                      z-index: 2;
                      position: relative;
                      box-shadow: 0px 0px 0px #000;
                      border: 1px solid #2497e3;
                      height: 18px;
                      width: 18px;
                      border-radius: 25px;
                      background: #a1d0ff;
                      cursor: pointer;
                      -webkit-appearance: none;
                      margin-top: -7px;
                    }
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
                    let ioosCategorySelect = dropdownSelect(shadow, container, true, false, "IOOS Category",
                        categories, (category) => {
                            let variables = category.variables.reduce(function(map, variable) {
                                map[variable.value] = variable;
                                return map;
                            }, {});
                            let variablesDropdown = dropdownSelect(shadow, container, true, false, category.value, variables, (variable) => {
                                this.filterDatasetResults();
                            });
                            this.explorer.app_data.dropdowns[category.value] = variablesDropdown;
                            variablesDropdown.style.display = category.state === 1 ? "" : "none";
                            this.filterDatasetResults();

                        });
                    ioosCategorySelect.sticky = true;
                    ioosCategorySelect.style.display = Object.keys(categories).length ? "block" : "none";
                });
                this.explorer.on("datasetsIndexUpdated", (datasetsIndex) => {
                    this.filterDatasetResults();
                });
                this.explorer.on("selectedYearsChanged", (year) => {
                    this.filterDatasetResults();
                })
            }

            this.elements = createSearchElements(this.explorer);
            this.container = this.elements.container;
            shadow.appendChild(this.container);

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

        filterDatasetResults() {
            if (!this.explorer) {
                return;
            }
            let boundsLayer = this.elements.mapcomponents.boundsLayer;
            if (boundsLayer) {
                boundsLayer.clearLayers();
            }
            let rows = this.elements.searchResults.closest("table").rows;
            let nMatchingDatasets = 0;
            for (let row = 1; row < rows.length; row++) {
                let dataset_url = rows[row].getAttribute("dataset-url");
                let includeDataset = this.isDatasetFilteredIn(dataset_url);
                rows[row].style.display = includeDataset ? "table-row" : "none";
                if (includeDataset) {
                    nMatchingDatasets++;
                    let dataset = this.explorer.getDataset(dataset_url);
                    if (dataset) {
                        let tdyears = rows[row].querySelector("td.years");
                        if (tdyears) {
                            tdyears.innerText = dataset.display_years.join(", ");
                        }
                    }
                    if (dataset && boundsLayer) {
                        //console.log(dataset);
                        let bounds = this.explorer.selectedYear ? dataset.bounds.year[this.explorer.selectedYear] : dataset.bounds.overall;
                        bounds = bounds || dataset.bounds.overall;
                        if (bounds) {
                            //TODO fix somewhere for bounds that cross the antimeridian.
                            if (bounds.lat.min !== undefined && bounds.lat.max !== undefined &&
                                bounds.lon.min !== undefined && bounds.lon.max !== undefined) {
                                let rect = L.rectangle([
                                    [bounds.lat.min, bounds.lon.min],
                                    [bounds.lat.max, bounds.lon.max]
                                ], {
                                    fillOpacity: 0
                                });
                                boundsLayer.addLayer(rect);
                            }
                        }
                    }
                }
                this.elements.searchResultsLabel.innerText = `${nMatchingDatasets?nMatchingDatasets:"No"} Dataset${nMatchingDatasets==1?"":"s"}`;


            }
        }
        isDatasetFilteredIn(dataset_url) {
            if (!this.explorer) {
                return true;
            }
            let explorer = this.explorer;
            let categories = Object.values(explorer.ioos_categories);
            for (let i = 0; i < categories.length; i++) {
                let category = categories[i];
                if (!category.state) continue;
                if (category.state < 0) { // exclude only these
                    if (category.dataset_urls.indexOf(dataset_url) >= 0) {
                        return false;
                    }
                } else { // include only datasets with these
                    if (category.dataset_urls.indexOf(dataset_url) < 0) {
                        return false;
                    }
                    // were any specific variables included/excluded
                    let ok = true;
                    category.variables.map(variable => {
                        if (!variable.state) return;
                        if (variable.state < 0) { // these to be excluded
                            if (variable.dataset_urls.indexOf(dataset_url) >= 0) {
                                ok = false;;
                            }

                        } else { // these must be included
                            if (variable.dataset_urls.indexOf(dataset_url) < 0) {
                                ok = false;
                            }
                        }
                    });
                    if (!ok) {
                        return false;
                    }
                }
            }

            let years = explorer.years.filter(year => year.state === 1);
            for (let i = 0; i < years.length; i++) {
                if (years[i].dataset_urls.indexOf(dataset_url) >= 0) {
                    return true;
                }
            }
            return false;
        }

        search() {
            [this.elements.searchResults].map(el => {
                while (el.lastChild) {
                    el.removeChild(el.lastChild);
                }
            });
            [this.shadow.getElementById("dataset_filters")].map(el => {
                while (el.lastChild && !el.lastChild.sticky) {
                    el.removeChild(el.lastChild);
                }
            });
            if (this.explorer) {
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
                tr.appendChild(createElement("td", {
                    class: "years"
                }, ""))
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
                        contents.setAttribute("colspan", 5);
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
                    let ds = this.explorer.addDataset(o.Info);
                    ds.tr = tr;
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
                        this.explorer.removeDataset(ds);
                        table.deleteRow(tr.rowIndex);
                    })
                    trashtd.appendChild(trash);
                    tr.appendChild(trashtd);
                }
                return tr;

            }
            let onResultsChanged = (x) => {};
            let tbody = this.elements.searchResults;
            let table = tbody.closest("table");
            let onHit = (hit) => {
                let row = hit2tr(hit);
                tbody.appendChild(row);
                this.filterDatasetResults();
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
                //TODO:
                if (this.explorer) {
                    this.explorer.setErddapClients(this._erddapClients);
                }
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