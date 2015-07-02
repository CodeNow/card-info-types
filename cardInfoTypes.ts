'use strict';

interface uuid {
    v4: any;
}

declare var require: any;

var uuid = require('uuid');

module ContainerItems {
  class DockerfileItem {
    name: string;
    path: string;
    commands: Array<any>;
    type: string;
    id: string;
    fromServer: boolean;
    hasFindReplace: boolean;
    legacyADD: boolean;
    constructor(public commandStr?: string) {
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
        this.commands = commandList.map((item) => {
          return {
            displayText: item.replace('RUN ', '').replace('#runnable-cache', '').trim(),
            text: item,
            cache: item.indexOf('#runnable-cache') > -1
          };
        });
      }
    }
    toString() {
      this.commands = this.commands || [];
      if (this.type === 'File') {
        this.path = this.path || '';
      } else {
        this.path = this.path || this.name;
      }

      var contents = 'ADD ["./' + this.name.trim() + '", "/' + this.path.trim() + '"]';
      var tempCommands = this.commands
        .filter((command) => !!(command.text.trim()))
        .map((command) => {
          if (command.cache) {
            command.text += ' #runnable-cache';
          } else {
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
          .map((command) => command.text)
          .join('\n');
      }

      return this.wrapWithType(contents);
    }
    wrapWithType(content: string) {
      return '#Start: ' + this.type + '\n' +
        content + '\n' +
        '#End';
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
}

export = ContainerItems;