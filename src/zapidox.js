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

    var Zapidox = function(){

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
            options = options || {
                bootstrap4: false
            }; // use markdown-it to translate to html.
            if (options.tableInTitle === undefined) {
                options.tableInTitle = options.bootstrap4 ? false : true;
            }
            if (!options.format) {

                options.format = (docs) => {
                    return docs;
                }
                if (typeof(markdownit) !== "undefined" && options.bootstrap4) {
                    var mdoptions = {
                        html: true,
                        linkify: true
                    };
                    if (window.hljs) {
                        mdoptions.highlight = (str, lang) => {
                            if (lang && hljs.getLanguage(lang)) {
                                try {
                                    return '<pre class="hljs"><code>' +
                                        hljs.highlight(lang, str, true).value +
                                        '</code></pre>';
                                } catch (__) {}
                            }

                            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
                        }
                    };
                    var md = window.markdownit(mdoptions);
                    md.renderer.rules.table_open = (tokens, idx) => {
                        return '<table class="table table-sm">';
                    };
                    options.format = (docs) => {
                        return md.render(docs);
                    }
                }
            }
            return new Promise((resolve, reject) => {
                var ds = erddap.getDataset(dataset_id);
                ds.fetchMetadata().then((meta) => {
                    let dataset_type = ds._summary.tabledap ? "tabledap" : (ds._summary.griddap ? "griddap" : (ds._summary.wms ? "wms" : "unknown"));
                    var dataset_link = getDatasetLink(erddap.endpoint, dataset_id, dataset_type);
                    var joinParts = (toc, parts) => {
                        if (toc.length && options.bootstrap4) {
                            var id = dataset_link + "|--overview";
                            toc.unshift("<p><a href='#" + id + "'>Overview</a></p>");
                            var body = parts.join("\n\n");
                            return [
                                '<div class="row">',
                                '<div class="col-sm-2 bg-light">',
                                '<div class="sticky-top">',
                                toc.join("\n"),
                                '</div>',
                                '</div>',
                                '<div class="col-sm-10">',
                                '',
                                body,
                                '</div>',
                                '</div>'
                            ].join("\n");
                        }
                        return parts.join("\n\n");
                    }
                    var toc = [];
                    var ncglobal = meta.info.attribute["NC_GLOBAL"];
                    var overview = getOverview(ncglobal, dataset_link, options, dataset_type);
                    var exampleQuerySection = [
                        "# Example Queries",
                        "", "Below are some example queries to get you started with " + ncglobal.title.value
                    ].join("\n")
                    var dimensions = "";
                    if (dataset_type === "griddap") {
                        dimensions = getVariablesTable(meta, "dimension", dataset_id, options, toc, dataset_link);
                        exampleQuerySection = "";
                    }
                    var variables = getVariablesTable(meta, "variable", dataset_id, options, toc, dataset_link);

                    var parts = [overview, dimensions, variables, exampleQuerySection];
                    var zapidox = options.zapidox || _getMetaZapidocs(meta);
                    if (dataset_type === "tabledap" && typeof(zapidox) == "object") {
                        if (options.example && zapidox.unshift) {
                            zapidox.unshift(options.example)
                        }
                        var docs = [];
                        var generateZDocs = (method) => {
                            generateMethodDocs(ds, method, options, toc, dataset_link).then((result) => {
                                parts.push(result);
                                if (zapidox.length) {
                                    generateZDocs(zapidox.shift());
                                } else {
                                    resolve(joinParts(toc, parts));
                                }
                            });

                        }
                        generateZDocs(zapidox.shift());
                    } else {
                        resolve(joinParts(toc, parts));
                    }
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
            var options = [],
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
        let generateMethodDocs = (dataset, method, options, toc, dataset_link) => {
            let getFormatName = (f) => f.replace(/^\./, "");
            return new Promise((resolve, reject) => {
                var formats = method.formats || [".csv0", ".jsonlKVP"]
                var output = [];
                var generateFormatMethodDocs = (format) => {
                    format = format || "";
                    var outputformat = {}[format] || format.replace(/^[^a-zA-Z]/g, "").replace(/[^a-zA-Z]$/g, "");
                    var base_url = dataset._summary.tabledap || dataset._summary.griddap;
                    var formatNoExtension = getFormatName(format);
                    var partial_url = base_url + "." + formatNoExtension
                    var full_url = partial_url + "?" + method.query;

                    var params = [];
                    if (full_url.startsWith("//")) {
                        full_url = location.protocol + full_url;
                    }
                    var searchParams = full_url.toLowerCase().startsWith("http") ? new URL(full_url).searchParams : new URL(full_url, dataset.erddap.endpoint).searchParams;
                    searchParams.forEach((i, k) => {
                        if (searchParams.get(k).length || method.query.indexOf(k + "=") >= 0 || method.query.indexOf(encodeURIComponent(k) + "=") >= 0) {
                            var param = {};
                            param[k] = searchParams.get(k);
                            params.push(param);
                        } else {
                            params.push(k);
                        }
                    });

                    var section_prefix = dataset_link + "|" + (dataset.dataset_id + "-" + method.name).replace(/\W/, '-').replace(/--/g, '-').toLowerCase();
                    let getIdPrefix = (f) => (method.name + "-" + getFormatName(f)).replace(/\W/, '-').replace(/--/g, '-').toLowerCase();
                    let id_prefix = getIdPrefix(format);
                    method.hash = '#' + section_prefix;

                    output.push("");
                    var formatSelected = false;
                    if (options.tableInTitle) {
                        output.push(["## ", dataset.dataset_id, ": ", method.name, " (", formatNoExtension, ")"].join(""));
                    } else {
                        if (options.bootstrap4) {
                            var title = ["<p>", '<a href="#', section_prefix, '">', method.name, "</a></p>"].join("");
                            if (toc.indexOf(title) < 0) {
                                toc.push(title);
                                formatSelected = true;
                                output.push(['<h2 id="' + section_prefix + '">', method.name, "</h2>"].join(""));
                                output.push("<div class='tab-pane container'>");
                                output.push('<ul class="nav nav-tabs">');
                                output.push('<li class="nav-item"><a class="nav-link active show" data-toggle="tab" href="#' + id_prefix + '">' + formatNoExtension + '</a></li>');
                                for (var x = 0; x < formats.length; x++) {
                                    output.push('<li class="nav-item"><a class="nav-link" data-toggle="tab" href="#' + getIdPrefix(formats[x]) + '">' + getFormatName(formats[x]) + '</a></li>');
                                }
                                output.push('</ul>');
                                output.push('<div class="tab-content">');
                            }

                            output.push('<div id="' + id_prefix + '" class="tab-pane container ' + (formatSelected ? "active show" : "fade") + '">');
                            output.push('<div class="row"><div >');
                        } else {
                            output.push("## " + method.name + " (" + formatNoExtension + ")");
                        }
                    }
                    output.push("");
                    output.push(method.description);
                    output.push("");

                    var getBeforeCode = (lang) => {
                        return "\n```" + lang
                    };
                    var getAfterCode = () => {
                        return "```"
                    };
                    var output_end = "";

                    if (options.bootstrap4) {
                        output_end = "</div></div></div>";
                        output.push("\n");
                        output.push('</div><div class="row">');
                        output.push('<ul class="nav nav-pills mb-5" id="pills-' + id_prefix + '-tab" role="tablist">');
                        var langSelected = true;
                        ["shell", "python", "r", "javascript", "csharp"].forEach((lang) => {
                            var fix = (id_prefix + '-' + lang).replace(/[^\w\-\d_]/g, '-');
                            output.push('<li class="nav-item">');
                            output.push('<a class="codetab nav-link' + (langSelected ? " active show " : " ") +
                                lang + '-lang" id="pills-' + fix + '-tab" data-lang=".' +
                                lang + '-lang" data-toggle="pill" href="#pills-' +
                                fix + '" role="tab" aria-controls="pills-' +
                                fix + '" aria-selected="' + langSelected + '">' +
                                lang + '</a>')
                            output.push('</li>');
                            langSelected = false;
                        });
                        output.push("</ul>");
                        output.push("<div class='row'></div>");
                        output.push('<div class="tab-content" id="pills-' + id_prefix + '-tabContent">');
                        getBeforeCode = (lang, active) => {
                            var fix = (id_prefix + '-' + lang).replace(/[^\w\-\d_]/g, '-');
                            return '<div class="tab-pane fade' + (active ? " show active" : "") + '" id="pills-' +
                                fix + '" role="tabpanel" aria-labelledby="pills-' + fix + '-tab">\n\n```' + lang;
                        }
                        getAfterCode = () => {
                            return "```\n\n</div>"
                        };
                    }

                    output.push(getBeforeCode("shell", true));
                    output.push("curl '" + full_url.replace(/'/, "\\'") + "'")
                    output.push(getAfterCode());
                    output.push(getBeforeCode("python"));
                    output.push(getPythonFunction(partial_url, params, method.query, format))
                    output.push(getAfterCode());
                    output.push(getBeforeCode("r"));
                    output.push(getRFunction(partial_url, params, method.query))
                    output.push(getAfterCode());
                    output.push(getBeforeCode("javascript"));
                    output.push(getJavascriptFunction(partial_url, params))
                    output.push(getAfterCode());
                    output.push(getBeforeCode("csharp"));
                    output.push("// csharp code coming soon....(ish)")
                    output.push(getAfterCode());

                    var queryResultToMarkdown = (result) => {
                        var o = [];
                        o.push("* The above commands return " + outputformat.toUpperCase() + " structured like this:");
                        o.push("");
                        o.push("```" + outputformat);
                        o.push(result);
                        o.push("```");
                        return o.join("\n");
                    }

                    var continueOrResolve = (result) => {
                        if (result) {
                            output.push(queryResultToMarkdown(result));
                        }
                        output.push(output_end);
                        if (formats.length) {
                            generateFormatMethodDocs(formats.shift());
                        } else {
                            if (options.bootstrap4) {
                                output.push("</div></div>");
                            }
                            resolve(output.join("\n"));
                        }
                    }
                    if (options.bootstrap4) {
                        output.push("</div>\n");
                        // in case of generating html in the browser,
                        // the output code examples are added after.
                        let output_id = id_prefix + '-output';
                        output.push('<div id="' + output_id + '">(fetching output)</div>');
                        continueOrResolve();
                        getQueryOutput(partial_url, params).then(queryOutput => {
                            let tries_remaining = 50;
                            let writeOutputFn = () => {
                                let el = document.getElementById(output_id) ||
                                    (this.shadowRoot && this.shadowRoot.getElementById(output_id));
                                if (el) {
                                    el.innerHTML = options.format(queryResultToMarkdown(queryOutput));
                                } else if (--tries_remaining) {
                                    //console.log(`trying ${tries_remaining} for ${output_id}`)
                                    setTimeout(writeOutputFn, 200);
                                }else{
                                   // console.log(output_id,this);
                                }
                            }
                            writeOutputFn = writeOutputFn.bind(this);
                            setTimeout(writeOutputFn, 0);
                            return;

                        }, (e) => {
                            console.log("todo log error");
                            return;
                            document.getElementById(output_id).innerHTML =
                                options.format(queryResultToMarkdown("sorry the request failed, an example is not available at this time."));
                        });
                    } else {
                        getQueryOutput(partial_url, params).then(queryOutput => {
                            continueOrResolve(queryOutput);
                        }, (e) => {
                            continueOrResolve("sorry the request failed, an example is not available at this time.");
                        });
                    }

                }
                generateFormatMethodDocs(formats.shift());
            });
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
            var headline = [
                "The [", ncglobal.title.value, "](", ncglobal.infoUrl.value,
                ") dataset is hosted in [ERDDAP](" + dataset_link + ")"
            ].join("");

            var output = [
                "",
                headline,
                "",
                ncglobal.summary.value,
            ];
            if (options.bootstrap4) {
                var id = dataset_link + "|--overview";
                output.unshift("<h2 id='" + id + "'>Overview</h2>");
                output.unshift('<div class="row"><div class="col-sm-12">');
                output.push('</div></div>');
            } else {
                output.unshift("# " + ncglobal.title.value);
            }

            var subtitle = "## Data Access Protocol";
            if (dataset_type === "tabledap") {
                subtitle = "## Tabledap Data Access Protocol";
            } else if (dataset_type === "griddap") {
                subtitle = "## Griddap Data Access Protocol";
            }
            output.push("");
            output.push(subtitle);
            output.push("Data from the " + ncglobal.title.value + " dataset can be fetched in [many formats](" + (dataset_link.replace(/[^\/]*$/, "documentation.html")) + ") using simple (restful) http requests.");
            output.push("");
            output.push("The [data access form](" + dataset_link + ") is a great way to get started, or to refine your query.");
            output.push("");

            /*
            output.push("The general format for tabledap queries is " +
                "<a href='"++"' title='"+dataset_link.replace(/.html$/,"")+"'>dataset_link</a>.<span title='eg. htmlTable, csv, nc, etc.'>format</span>?comma_separated_variable,&filter&anotherFilter")
            */
            return output.join("\n");

        }
        let getVariablesTable = (meta, _type, dataset_id, options, toc, dataset_link) => {
            let [singular, plural] = {
                "variable": ["Variable", "Variables"],
                "dimension": ["Dimension", "Dimensions"]
            }[_type];
            var rows = [
                [singular, "Type", "Comment"],
                ["----", "----", "-------"]
            ];
            var maxlen = [0, 0, 0];
            meta._fieldnames.forEach((fieldname) => {
                if (meta.info[_type][fieldname]) {
                    var v = meta.info[_type][fieldname];
                    var attr = meta.info.attribute[fieldname];
                    var comment = attr.Comment ? attr.Comment.value : (attr.long_name ? attr.long_name.value.indexOf(' ') > 0 ? attr.long_name.value : "" : "");
                    var row = [fieldname, v[""].type, comment];

                    for (var i = 0; i < row.length; i++) {
                        maxlen[i] = Math.max(maxlen[i], row[i].length)
                    }
                    rows.push(row);
                }
            });
            var output = [];
            rows.forEach((row) => {
                for (var i = 0; i < maxlen.length; i++) {
                    row[i] = row[i].padEnd(maxlen[i], " ");
                }
                output.push(row.join(" | "));
            });
            output[1] = output[1].replace(/\s/g, "-").replace("-|-", " | ");

            output.unshift("");
            if (options.tableInTitle) {
                output.unshift(`## ${dataset_id}: ${singular}`);
            } else {
                if (options.bootstrap4) {
                    var id = `${dataset_link}|${dataset_id}--${_type}s`;
                    output.unshift(`<h2 id='${id}'>${plural}</h2>`);
                    output.unshift('<div class="row"><div class="col-sm-12">');
                    output.push('</div></div>');
                    toc.push(`<p><a href='#${id}'>${plural}</a></p>`);
                } else {
                    output.unshift(`## ${plural}`);
                }
            }
            return output.join("\n");
        }

        this.generateDocs = (dataset_url, example)=>{

            let options = {
                bootstrap4: true,
                example: example
            };

            let parsed = parseErddapUrl(dataset_url);
            let erddap = new ErddapClient(parsed.erddap_url);

            return generateAPIDocs(erddap, parsed.dataset_id, options).then((apidocs) => {
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