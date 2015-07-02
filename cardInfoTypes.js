'use strict';
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var uuid = require('uuid');
var ContainerItems;
(function (ContainerItems) {
    var ContainerItem = (function () {
        function ContainerItem() {
        }
        ContainerItem.prototype.wrapWithType = function (content) {
            return '#Start: ' + this.type + '\n' +
                content + '\n' +
                '#End';
        };
        return ContainerItem;
    })();
    var DockerfileItem = (function (_super) {
        __extends(DockerfileItem, _super);
        function DockerfileItem(commandStr) {
            this.commandStr = commandStr;
            this.id = uuid.v4();
            if (commandStr) {
                this.fromServer = true;
                var commandList = commandStr.split('\n');
                var add = /^ADD (.*)/.exec(commandList[0]);
                try {
                    // ADD paramaters are in array syntax
                    var params = JSON.parse(add[1]);
                    this.name = params[0].replace('./', '');
                    this.path = params[1].replace('/', '');
                }
                catch (e) {
                    // ADD is *not* in array syntax (legacy)
                    this.legacyADD = true;
                    var commands = /^ADD ((?:\\\s|[^\s])*) ((?:\\\s|[^\s])*)/.exec(commandList[0]);
                    this.name = commands[1].replace('./', '');
                    this.path = commands[2].replace('/', '');
                }
                commandList.splice(0, 2); //Remove the ADD and the WORKDIR
                if (commandList.length && commandList[0].indexOf('ADD ./translation_rules.sh') > -1) {
                    this.hasFindReplace = true;
                    // Remove add/chmod/run
                    commandList.splice(0, 2);
                }
                this.commands = commandList.map(function (item) {
                    return {
                        displayText: item.replace('RUN ', '').replace('#runnable-cache', '').trim(),
                        text: item,
                        cache: item.indexOf('#runnable-cache') > -1
                    };
                });
            }
        }
        DockerfileItem.prototype.toString = function () {
            this.commands = this.commands || [];
            if (this.type === 'File') {
                this.path = this.path || '';
            }
            else {
                this.path = this.path || this.name;
            }
            var contents = 'ADD ["./' + this.name.trim() + '", "/' + this.path.trim() + '"]';
            var tempCommands = this.commands
                .filter(function (command) { return !!(command.text.trim()); })
                .map(function (command) {
                if (command.cache) {
                    command.text += ' #runnable-cache';
                }
                else {
                    command.text = command.text.replace('#runnable-cache', '').trim();
                }
                return command;
            });
            if (this.hasFindReplace) {
                tempCommands = [
                    {
                        text: 'ADD ./translation_rules.sh translation_rules.sh'
                    }, {
                        text: 'RUN bash translation_rules.sh'
                    }
                ].concat(tempCommands);
            }
            if (tempCommands.length) {
                contents += '\nWORKDIR /' + this.path.trim() + '\n'
                    + tempCommands
                        .map(function (command) { return command.text; })
                        .join('\n');
            }
            return this.wrapWithType(contents);
        };
        return DockerfileItem;
    })(ContainerItem);
    var File = (function (_super) {
        __extends(File, _super);
        function File(commandStr) {
            this.type = 'File';
            _super.call(this, commandStr);
        }
        File.prototype.clone = function () {
            var _this = this;
            var myFile = new File(this.commandStr);
            Object.keys(this).forEach(function (key) { return myFile[key] = _this[key]; });
            return myFile;
        };
        return File;
    })(DockerfileItem);
    ContainerItems.File = File;
    var Repository = (function (_super) {
        __extends(Repository, _super);
        function Repository(commandStr) {
            // this.type will be set if we're being extended by MainRepo
            if (!this.type) {
                this.type = 'Repository';
            }
            _super.call(this, commandStr);
        }
        Repository.prototype.clone = function () {
            var _this = this;
            var repo = new Repository(this.commandStr);
            Object.keys(this).forEach(function (key) { return repo[key] = _this[key]; });
            return repo;
        };
        return Repository;
    })(DockerfileItem);
    ContainerItems.Repository = Repository;
    var MainRepository = (function (_super) {
        __extends(MainRepository, _super);
        function MainRepository(commandStr) {
            this.type = 'Main Repository';
            _super.call(this, commandStr);
        }
        return MainRepository;
    })(Repository);
    ContainerItems.MainRepository = MainRepository;
    var Packages = (function (_super) {
        __extends(Packages, _super);
        function Packages(commandStr) {
            this.commandStr = commandStr;
            this.preamble = 'RUN apt-get update -y && apt-get upgrade -y && apt-get ';
            this.type = 'Packages';
            _super.call(this);
            if (commandStr) {
                this.fromServer = true;
                this.packageList = commandStr.replace(this.preamble, '');
            }
        }
        Packages.prototype.toString = function () {
            var contents = this.preamble + this.packageList;
            return this.wrapWithType(contents);
        };
        Packages.prototype.clone = function () {
            var _this = this;
            var packages = new Packages(this.commandStr);
            Object.keys(this).forEach(function (key) { return packages[key] = _this[key]; });
            return packages;
        };
        return Packages;
    })(ContainerItem);
    ContainerItems.Packages = Packages;
})(ContainerItems || (ContainerItems = {}));
module.exports = ContainerItems;
