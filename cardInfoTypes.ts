'use strict';

interface uuid {
  v4: any;
}

declare var require: any;

var uuid = require('uuid');

module ContainerItems {
  class ContainerItem {
    name: string;
    path: string;
    type: string;
    id: string;
    fromServer: boolean;
    legacyADD: boolean;
    wrapWithType(content: string) {
      return '#Start: ' + this.type + '\n' +
        content + '\n' +
        '#End';
    }
  }

  class DockerfileItem extends ContainerItem{
    commands: string;
    hasFindReplace: boolean;
    constructor(public commandStr?: string) {
      super();
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
        } catch (e) {
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
        this.commands = commandList.map(function(item) {
          return item.replace('RUN ', '');
        }).join('\n');
      }
    }
    toString() {
      this.commands = this.commands || '';
      if (this.type === 'File') {
        this.path = this.path || '';
      } else {
        this.path = this.path || this.name;
      }

      var contents = 'ADD ["./' + this.name.trim() + '", "/' + this.path.trim() + '"]';
      var tempCommands = this.commands
        .split('\n')
        .filter((command) => !!(command.trim()));

      if (this.hasFindReplace) {
        tempCommands = [
          'ADD ./translation_rules.sh translation_rules.sh',
          'bash translation_rules.sh'
        ].concat(tempCommands);
      }

      if (tempCommands.length) {
        contents += '\nWORKDIR /' + this.path.trim() + '\n'
        + tempCommands
          .map((command) => {
            if (command.indexOf('ADD') === 0) {
              return command;
            }
            return 'RUN ' + command;
          })
          .join('\n');
      }

      return this.wrapWithType(contents);
    }
  }

  export class File extends DockerfileItem {
    constructor(commandStr: string) {
      this.type = 'File';
      super(commandStr);
    }
    clone() {
      var myFile = new File(this.commandStr);
      Object.keys(this).forEach((key) => myFile[key] = this[key]);
      return myFile;
    }
  }

  export class Repository extends DockerfileItem {
    constructor(commandStr: string) {
      // this.type will be set if we're being extended by MainRepo
      if (!this.type) {
        this.type = 'Repository';
      }
      super(commandStr);
    }
    clone() {
      var repo = new Repository(this.commandStr);
      Object.keys(this).forEach((key) => repo[key] = this[key]);
      return repo;
    }
  }
  export class MainRepository extends Repository {
    constructor(commandStr: string) {
      this.type = 'Main Repository';
      super(commandStr);
    }
  }
  export class Packages extends ContainerItem {
    packageList: string;
    private preamble: string;
    constructor(public commandStr: string) {
      super();
      this.preamble = 'RUN apt-get update -y && apt-get upgrade -y && apt-get install ';
      this.type = 'Packages';

      if (commandStr) {
        this.fromServer = true;
        this.packageList = commandStr.replace(this.preamble, '');
      }
    }
    toString() {
      var contents = this.preamble + this.packageList;
      return this.wrapWithType(contents);
    }
    clone() {
      var packages = new Packages(this.commandStr);
      Object.keys(this).forEach((key) => packages[key] = this[key]);
      return packages;
    }
  }
}

export = ContainerItems;