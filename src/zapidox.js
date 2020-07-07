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
        typeof define === 'function' && define.amd ? define(factory) : global.Zapidox = factory();
}(this, (function() {
    'use strict';

    var Zapidox = function() {

        let parseErddapUrl = (query_url) => {
            var erddap_url = new URL(query_url.replace(/\/(((table|grid)dap)|info).*$/g, "/")).toString();
            var dataset_id = query_url.substring(erddap_url.length).split(/[\?\.\/]/)[1];
            var query = query_url;
            if (query.indexOf('?') >= 0) {
                query = query.substring(query.indexOf('?') + 1);
            }
            return {
                erddap_url: erddap_url,
                dataset_id: dataset_id,
                query: query
            };
        }

        let getErddapZapidocs = (query_url) => {
            // get the current zapidocs from ERDDAP, either as an object,
            // or as a string if the current value doesn't parse to a json object.
            return new Promise((resolve, reject) => {
                try {
                    var parsed = parseErddapUrl(query_url);
                    var erddap = new ErddapClient(parsed.erddap_url);
                    var ds = erddap.getDataset(parsed.dataset_id);
                    ds.fetchMetadata().then((meta) => {
                        resolve(_getMetaZapidocs(meta));
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }
        let _getMetaZapidocs = (meta) => {
            var ncglobal = meta.info.attribute["NC_GLOBAL"];
            var zapidox = (ncglobal.zapidox && ncglobal.zapidox.value) || "[]";
            if (zapidox) {
                try {
                    zapidox = JSON.parse(zapidox);
                } catch (e) {
                    console.log("couldn't parse zapidox attribute", e);
                }
            }
            if (typeof(zapidox) == 'object' && zapidox.length == 0) {
                var defaultDataQuery = "";
                var methodName = "getSomeData";
                var description = "Fetch 10 rows of data";
                if (ncglobal.defaultDataQuery) {
                    defaultDataQuery = '&' + (ncglobal.defaultDataQuery.value.replace(/&orderByLimit[^&]*/, "").replace(/^&/, ""));
                    methodName = "getDefaultData";
                    description += " using the defaultDataQuery";
                }
                zapidox = [{
                    name: methodName,
                    description: description,
                    formats: [".csv0", ".jsonlKVP"],
                    query: meta._fieldnames.join(",") + defaultDataQuery + '&orderByLimit("10")'
                }];
            }
            return zapidox;
        }
        let generateAPIDocs = (erddap, dataset_id, options) => {
            options = options || {}; // use markdown-it to translate to html.
            return new Promise((resolve, reject) => {
                var ds = erddap.getDataset(dataset_id);
                ds.fetchMetadata().then((meta) => {
                    let dataset_type = ds._summary.tabledap ? "tabledap" : (ds._summary.griddap ? "griddap" : (ds._summary.wms ? "wms" : "unknown"));
                    var dataset_link = getDatasetLink(erddap.endpoint, dataset_id, dataset_type);
                    var toc = [];
                    var ncglobal = meta.info.attribute["NC_GLOBAL"];
                    var overview = getOverview(ncglobal, dataset_link, options, dataset_type);
                    let exampleQuerySection = document.createElement("div");
                    exampleQuerySection.appendChild(createElement("h2", {}, "Example Queries"));
                    exampleQuerySection.appendChild(createElement("p", {},
                        "Below are some example queries to get you started with " + ncglobal.title.value));
                    let parts = createElement("div", {
                        id: "parts"
                    })
                    parts.appendChild(overview);
                    parts.appendChild(exampleQuerySection);

                    let zapidox = options.zapidox || _getMetaZapidocs(meta);
                    if (dataset_type === "tabledap" && typeof(zapidox) == "object") {
                        if (options.example && zapidox.unshift) {
                            zapidox.unshift(options.example)
                        }
                        zapidox.map(method => {
                            let methodDocs = generateMethodDocs(ds, method, options, toc, dataset_link);
                            parts.appendChild(methodDocs);
                        });
                    }
                    resolve(parts);

                });
            });
        }
        let getJavascriptFunction = (url, params) => {
            var output = [];
            output.push('var url = new URL("' + url + '"),');
            output.push('params = ' + JSON.stringify(params, null, 4) + ";");
            output.push("");

            output.push("url = url + '?' + params.map(v => typeof(v)=='string'? encodeURIComponent(v) :");
            output.push("     (encodeURIComponent(Object.keys(v)[0]) + '=' + encodeURIComponent(Object.values(v)[0]))");
            output.push(").join('&');");
            output.push("");
            output.push("fetch(url)");
            output.push("    .then(response => response.text())");
            output.push("    .then((data)=>{");
            output.push("      console.log(data);");
            output.push("    });");

            return output.join("\n");
        }
        let getPythonFunction = (url, params, query, format) => {
            var output = [];
            output.push("import requests");
            output.push("import pandas as pd");
            output.push("from io import StringIO");
            output.push("")
            output.push("url = '" + url + "'")
            output.push("fields = '" + params[0] + "'");
            output.push("params = [")
            output.push("    fields")
            for (var i = 1; i < params.length; i++) {
                var o = params[i];
                var line = "   ,'" + o + "'";
                if (typeof(o) != 'string') {
                    line = "   ,'" + Object.keys(o)[0] + "=" + Object.values(o)[0] + "'";
                }
                output.push(line);
            }
            output.push("]");
            output.push("response = requests.get( url + '?' + '&'.join(params))")
            output.push("response.raise_for_status()")
            output.push("")
            output.push("# error raised above if request failed")
            if (format.toLowerCase().startsWith(".csv")) {
                output.push("df = pd.read_csv(StringIO(response.text), names=fields.split(','), parse_dates=['time'])")
                output.push("df.head()")
            } else if (format.toLowerCase().startsWith(".jsonlkvp")) {
                output.push("jsonlKVP = '[' + ','.join(response.text.strip().split('\\n'))+']'")
                output.push("df = pd.read_json(jsonlKVP, orient='records')")
                output.push("df.head()")
            } else {
                output.push("response.text");
            }
            return output.join("\n");
        }
        let getRFunction = (url, params) => {
            var output = [];
            output.push("require(httr)");
            let options = [],
                args = {};
            params.forEach(o => {
                if (typeof(o) == 'string') {
                    options.push(o);
                } else {
                    args[Object.keys(o)[0]] = Object.values(o)[0];
                }
            });
            output.push("params <- list()");
            Object.keys(args).forEach(key => {
                output.push("params[[ '" + key + "' ]] <- '" + args[key] + "'");
            })
            output.push("");

            var fields = options.shift();
            output.push("fields <- '" + fields + "'");

            output.push("options <- list(");
            output.push("    fields" + (options.length ? "," : ""));
            output.push(options.map(o => "    '" + o + "'").join(",\n"));
            output.push(")")
            output.push("options <- lapply(options, URLencode, reserved=TRUE)");
            output.push("");
            output.push('url <- sprintf("' + url + '?%s", ' + "paste(options, collapse='&'))");
            output.push("response = GET(url)")
            return output.join("\n");

        }
        let json2csv0 = (data) => {
            let csv = Papa.unparse(data.table.rows);
            return csv;
        }
        let json2jsonlKVP = (data) => {
            let lines = [];
            let colNames = data.table.columnNames;
            let ncols = colNames.length;
            let nrows = data.table.rows.length;
            for (var i = 0; i < nrows; i++) {
                let line = {};
                let row = data.table.rows[i];
                for (var j = 0; j < ncols; j++) {
                    line[colNames[j]] = row[j];
                }
                lines.push(JSON.stringify(line));
            }
            let kvp = lines.join("\n");
            return kvp;
        }
        let getQueryOutput = (url, params) => {
            var reformat = {
                "csv0": json2csv0,
                "jsonlKVP": json2jsonlKVP
            }
            let formatWanted = false;
            let rx = /\.([^\.]*)$/;
            let arr = rx.exec(url);
            if (arr.length == 2) {
                formatWanted = arr[1];
            }
            let fnFormat = reformat[formatWanted];


            var url = url.replace(rx, ".json"); // for jsonp test
            url = url + '?' + params.map(v => typeof(v) == 'string' ? encodeURIComponent(v) :
                (encodeURIComponent(Object.keys(v)[0]) + '=' + encodeURIComponent(Object.values(v)[0]))
            ).join('&');

            url = url + (url.endsWith("?") ? "" : "&") + 'orderByLimit("15")';

            //fetchJsonp(url + urlParams.toString(),{ timeout: timeout, headers: {'Cache-Control': 'no-cache', 'Pragma': 'no-cache'}, jsonpCallback: ".jsonp"})


            return ErddapClient.fetchJsonp(url)
                .then(data => {
                    if (fnFormat) {
                        try {
                            return fnFormat(data);
                        } catch (e) {
                            console.log("failed to reformat data from json to " + formatWanted, e);
                        }
                    }
                    data = JSON.stringify(data);
                    var lines = data.split("\n");
                    if (lines.length > 24) {
                        lines = lines.splice(0, 15);
                        lines.push("...");
                    }
                    return lines.join("\n");
                }, e => {
                    console.log("problem processing", url, e);
                });
        }
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
        let generateMethodDocs = (dataset, method, options, toc, dataset_link) => {
            let getFormatName = (f) => f.replace(/^\./, "");
            let formats = method.formats || [".csv0", ".jsonlKVP"]
            let section_prefix = dataset_link + "|" + (dataset.dataset_id + "-" + method.name).replace(/\W/, '-').replace(/--/g, '-').toLowerCase();
            let output = document.createElement('div',{class: "container-fluid"});
            output.appendChild(createElement("h3", {
                id: section_prefix
            }, `${method.name}`));
            output.appendChild(createElement("p", {}, method.description));
            let formatsTabContent = createElement("div", {
                class: "tab-content"
            });
            let formatsTabPane = createElement("div", {
                class: "tab-pane h-100"
            });
            let formatsList = createElement("ul", {
                class: "nav nav-tabs"
            });
            formatsTabPane.appendChild(formatsList);
            formatsTabPane.appendChild(formatsTabContent);
            output.appendChild(formatsTabPane);
            let firstFormat = true;

            formats.map(format => {
                let outputformat = {}[format] || format.replace(/^[^a-zA-Z]/g, "").replace(/[^a-zA-Z]$/g, "");
                let base_url = dataset._summary.tabledap || dataset._summary.griddap;
                let formatNoExtension = getFormatName(format);
                let partial_url = base_url + "." + formatNoExtension
                let full_url = partial_url + "?" + method.query;

                let params = [];
                if (full_url.startsWith("//")) {
                    full_url = location.protocol + full_url;
                }
                let searchParams = full_url.toLowerCase().startsWith("http") ? new URL(full_url).searchParams : new URL(full_url, dataset.erddap.endpoint).searchParams;
                searchParams.forEach((i, k) => {
                    if (searchParams.get(k).length || method.query.indexOf(k + "=") >= 0 || method.query.indexOf(encodeURIComponent(k) + "=") >= 0) {
                        let param = {};
                        param[k] = searchParams.get(k);
                        params.push(param);
                    } else {
                        params.push(k);
                    }
                });

                let getIdPrefix = (f) => (method.name + "-" + getFormatName(f)).replace(/\W/, '-').replace(/--/g, '-').toLowerCase();
                let id_prefix = getIdPrefix(format);
                method.hash = '#' + section_prefix;
                let li = createElement("li", {
                    class: "nav-item"
                });
                let a = createElement("a", {
                    class: "nav-link" + (firstFormat ? " active show" : ""),
                    "data-toggle": "pill",
                    href: "#" + id_prefix
                }, formatNoExtension);
                li.appendChild(a);
                formatsList.appendChild(li);

                let div = createElement('div', {
                    'class': "tab-pane h-100 fade" + (firstFormat ? " active show" : ""),
                    id: id_prefix,
                    role: "tabpanel"
                });
                let ul = document.createElement('ul');
                ul.setAttribute('class', "nav nav-pills mb-5");
                ul.setAttribute('id', `pills-${id_prefix}-tab`);
                ul.setAttribute("role", "tablist");
                div.appendChild(ul);
                firstFormat = false;
                var langSelected = true;
                ["shell", "python", "r", "javascript", "csharp"].forEach((lang) => {
                    var fix = (id_prefix + '-' + lang).replace(/[^\w\-\d_]/g, '-');
                    let li = document.createElement('li');
                    li.setAttribute("class", "nav-item");
                    let a = document.createElement('a');
                    a.setAttribute("class", "codetab nav-link" + (langSelected ? " active show " : " ") + lang + "-lang");
                    a.setAttribute("id", `pills-${fix}-tab`);
                    a.setAttribute("data-lang", `.${lang}-lang`)
                    a.setAttribute("data-toggle", "pill");
                    a.setAttribute("href", `#pills-${fix}`);
                    a.setAttribute("role", "tab");
                    a.setAttribute("aria-controls", `pills-${fix}`);
                    a.setAttribute("aria-selected", langSelected);
                    a.innerText = lang;
                    li.appendChild(a);
                    ul.appendChild(li);
                    langSelected = false;
                });
                formatsTabContent.appendChild(div);

                let tabcontent = createElement("div", {
                    class: "tab-content",
                    id: `pills-${id_prefix}-tabContent`
                });
                div.appendChild(tabcontent)
                let codeElement = (lang, code, active) => {
                    let fix = (id_prefix + '-' + lang).replace(/[^\w\-\d_]/g, '-');
                    let div = document.createElement('div');
                    div.setAttribute("class", 'tab-pane fade' + (active ? " show active" : ""));
                    div.setAttribute("id", `pills-${fix}`);
                    div.setAttribute("role", "tabpanel");
                    div.setAttribute("aria-labelledby", `pills-${fix}-tab`);

                    let codeEl = createElement("code", {
                        class: `language-${lang}`
                    }, code);
                    if(hljs){
                        hljs.highlightBlock(codeEl)
                    }
                    let pre = createElement("pre");
                    pre.appendChild(codeEl);
                    div.appendChild(pre);
                    return div;
                }

                tabcontent.appendChild(codeElement("shell", "curl '" + full_url.replace(/'/, "\\'") + "'", true));
                tabcontent.appendChild(codeElement("python", getPythonFunction(partial_url, params, method.query, format)));
                tabcontent.appendChild(codeElement("r", getRFunction(partial_url, params, method.query)));
                tabcontent.appendChild(codeElement("javascript", getJavascriptFunction(partial_url, params)));
                tabcontent.appendChild(codeElement("csharp", "// csharp code coming soon....(ish)"));

                var queryResultElement = (result) => {
                    let div = createElement("div");
                    let p = createElement("p", {
                        class: "lead"
                    });
                    p.innerText = "* The above commands return " + outputformat.toUpperCase() + " structured like this:";
                    div.appendChild(p);
                    let code = createElement("code",{class: `language-${format}`},result);
                    let pre = createElement("pre");
                    pre.appendChild(code);
                    div.appendChild(pre);
                    if(hljs){
                        hljs.highlightBlock(code)
                    }

                    return div;
                }

                let query_output_el = createElement("div", {}, "(fetching output)");
                div.appendChild(query_output_el);

                setTimeout(() => {
                    getQueryOutput(partial_url, params).then(queryOutput => {
                        emptyElement(query_output_el).appendChild(queryResultElement(queryOutput));
                    }, (e) => {
                        let el = queryResultElement("sorry the request failed, an example is not available at this time.");
                        emptyElement(query_output_el).appendChild(el);
                    });
                }, 0)


            });
            return output;
        }
        let emptyElement = (el) => {
            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }
            return el;
        }

        let getDatasetLink = (erddap_url, dataset_id, dataset_type) => {
            //TODO: might not be tabledap.
            return [erddap_url,
                erddap_url.endsWith("/") ? ":" : "/",
                dataset_type,
                "/",
                dataset_id,
                ".html"
            ].join("");
        }
        let getOverview = (ncglobal, dataset_link, options, dataset_type) => {
            let div = createElement("div", {
                class: "row"
            });
            let div1 = createElement("div", {
                class: "col-sm-12"
            });
            var id = dataset_link + "|--overview";
            div1.appendChild(createElement("h2", {
                id: id
            }, "Overview"));

            let p = createElement("p", {
                class: "lead"
            });
            p.appendChild(document.createTextNode("The "));
            p.appendChild(createElement("a", {
                href: ncglobal.infoUrl.value,
                target: "_blank"
            }, ncglobal.title.value));
            p.appendChild(document.createTextNode(" dataset is hosted in "));
            p.appendChild(createElement("a", {
                href: dataset_link,
                target: "_blank"
            }, "ERDDAP"));
            div1.appendChild(p);
            div1.appendChild(createElement("p", {}, ncglobal.summary.value));

            let div2 = document.createElement("div");
            if (dataset_type === "tabledap") {
                div2.appendChild(createElement("h2", {}, "Tabledap Access Protocol"))
            } else if (dataset_type === "griddap") {
                div2.appendChild(createElement("h2", {}, "Griddap Access Protocol"))
            } else {
                div2.appendChild(createElement("h2", {}, "Data Access Protocol"))
            }
            let p2 = createElement("p2", {}, "Data from the " + ncglobal.title.value + " dataset can be fetched in ");
            p2.appendChild(createElement("a", {
                href: dataset_link.replace(/[^\/]*$/) + "documentation.html"
            }, "many formats"));
            p2.appendChild(document.createTextNode(" using simple (restful) http requests."));
            div2.appendChild(p2);
            let p3 = createElement("p", {}, "The ");
            p3.appendChild(createElement("a", {
                href: dataset_link
            }, "data access form"));
            p3.appendChild(document.createTextNode(" is a great way to get started, or to refine your query."));
            div2.appendChild(p3);

            /*
            output.push("The general format for tabledap queries is " +
                "<a href='"++"' title='"+dataset_link.replace(/.html$/,"")+"'>dataset_link</a>.<span title='eg. htmlTable, csv, nc, etc.'>format</span>?comma_separated_variable,&filter&anotherFilter")
            */
            div.appendChild(div1);
            div1.appendChild(div2);
            return div;
        }

        this.generateDocs = (dataset_url, example) => {

            let options = {
                example: example
            };

            let parsed = parseErddapUrl(dataset_url);
            let erddap = new ErddapClient(parsed.erddap_url);

            return generateAPIDocs(erddap, parsed.dataset_id, options).then((apidocs) => {
                return apidocs;
                //var docid = getDatasetLink(erddap.base_url,dsid);
                //$(":root").attr('id',docid);
                //if(!window.location.hash.startsWith("#"+docid)){
                //    window.location.hash = docid;
                //}
                //$("#editor_link").prop("href","./editor/"+window.location.hash.split("|")[0]);
                //$("#output").val(apidocs);
                //$("#output").attr("rows",apidocs.split("\n").length);
                //$("#saveas").text("save markdown to slate file includes/_"+dsid+".md");
                var result = options.format(apidocs);
                //$("#preview").empty();
                //$("#preview").append($(result));
                //$("#output").hide();
                //var oldhash =  window.location.hash.substring(1);
                //if(example && example.hash){
                //    oldhash = example.hash;
                //}
                //window.location.hash = "#";
                //setTimeout(function(){
                //    window.location.hash = oldhash;
                //},0);
                let el = document.createElement("div");
                el.innerHTML = result;
                return el;

            });
        }
    }
    Zapidox.generate = (dataset_url, example) => new Zapidox().generateDocs(dataset_url, example);
    return Zapidox;
})));