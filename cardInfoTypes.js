'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var uuid = require('uuid');
var ContainerItems;
(function (ContainerItems) {
    var DockerfileItem = (function () {
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
                // migrate translation_rules -> find_and_replace
                if (commandList.length) {
                    commandList = commandList.map(function (item) {
                        return item.replace(/translation_rules\.sh/ig, 'find_and_replace.sh');
                    });
                }
                if (commandList.length && commandList[0].indexOf('ADD ./find_and_replace.sh') > -1) {
                    this.hasFindReplace = true;
                    // Remove add/chmod/run
                    commandList.splice(0, 2);
                }
                this.commands = commandList.map(function (item) {
                    return item.replace('RUN ', '');
                }).join('\n');
            }
        }
        DockerfileItem.prototype.toString = function () {
            this.commands = this.commands || '';
            if (this.type === 'File') {
                this.path = this.path || '';
            }
            else {
                this.path = this.path || this.name;
            }
            var contents = 'ADD ["./' + this.name.trim() + '", "/' + this.path.trim() + '"]';
            var tempCommands = this.commands
                .split('\n')
                .filter(function (command) { return !!(command.trim()); });
            if (this.hasFindReplace) {
                tempCommands = [
                    'ADD ./find_and_replace.sh find_and_replace.sh',
                    'bash find_and_replace.sh'
                ].concat(tempCommands);
            }
            if (tempCommands.length) {
                contents += '\nWORKDIR /' + this.path.trim() + '\n'
                    + tempCommands
                        .map(function (command) {
                        if (command.indexOf('ADD') === 0) {
                            return command;
                        }
                        return 'RUN ' + command;
                    })
                        .join('\n');
            }
            return this.wrapWithType(contents);
        };
        DockerfileItem.prototype.wrapWithType = function (content) {
            return '#Start: ' + this.type + '\n' +
                content + '\n' +
                '#End';
        };
        return DockerfileItem;
    })();
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
})(ContainerItems || (ContainerItems = {}));
module.exports = ContainerItems;
