'use strict';

interface uuid {
  v4: any;
}

declare let require: any;

let uuid = require('uuid');


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

  export class Command {
    command: string;
    body: string;
    cache: boolean;
    constructor(commandStr: string) {
      let instructionsRegex = /^(CMD|FROM|MAINTAINER|RUN|EXPOSE|ENV|ADD|ENTRYPOINT|VOLUME|USER|WORKDIR|ONBUILD|COPY)(\s*)/i;

      let tmpResult = commandStr.match(instructionsRegex);
      if (!tmpResult) {
        throw new Error('Proper Docker command not found in line ' + commandStr);
      }
      this.command = tmpResult[1];

      commandStr = commandStr.replace(tmpResult[0], '');

      if (commandStr.indexOf('#runnable-cache') > -1) {
        this.cache = true;
        commandStr = commandStr.replace('#runnable-cache', '');
      } else {
        this.cache = false;
      }

      this.body = commandStr.trim();
    }
    toString() {
      let arr = [
        this.command,
        this.body
      ];
      if (this.cache) {
        arr.push('#runnable-cache');
      }
      return arr.join(' ');
    }
    clone() {
      return new Command(this.toString());
    }
  }

  class DockerfileItem extends ContainerItem{
    commands: Array<Command>;
    hasFindReplace: boolean;
    private static translationCommands = [
      new Command('ADD ./translation_rules.sh translation_rules.sh'),
      new Command('RUN bash translation_rules.sh')
    ];
    constructor(public commandStr?: string) {
      super();
      this.id = uuid.v4();
      if (commandStr) {
        this.fromServer = true;
        let commandList = commandStr.split('\n');
        let add = /^ADD (.*)/.exec(commandList[0]);

        try {
          // ADD paramaters are in array syntax
          let params = JSON.parse(add[1]);

          this.name = params[0].replace('./', '');
          this.path = params[1].replace('/', '');
        } catch (e) {
          // ADD is *not* in array syntax (legacy)
          this.legacyADD = true;
          let commands = /^ADD ((?:\\\s|[^\s])*) ((?:\\\s|[^\s])*)/.exec(commandList[0]);
          this.name = commands[1].replace('./', '');
          this.path = commands[2].replace('/', '');
        }

        commandList.splice(0, 2); //Remove the ADD and the WORKDIR
        if (commandList.length && commandList[0].indexOf('ADD ./translation_rules.sh') > -1) {
          this.hasFindReplace = true;
          // Remove add/chmod/run
          commandList.splice(0, 2);
        }
        this.commands = commandList
        .filter(Boolean)
        .map((item) => {
          return new Command(item);
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

      let contents = 'ADD ["./' + this.name.trim() + '", "/' + this.path.trim() + '"]';
      let tempCommands = this.commands;

      if (this.hasFindReplace) {
        tempCommands = DockerfileItem.translationCommands.concat(tempCommands);
      }

      if (tempCommands.length) {
        contents += '\nWORKDIR /' + this.path.trim() + '\n'
        + tempCommands
          .map((command) => command.toString().trim())
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
      let myFile = new File(this.commandStr);
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
      let repo = new Repository(this.commandStr);
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
      let contents = this.preamble + this.packageList;
      return this.wrapWithType(contents);
    }
    clone() {
      let packages = new Packages(this.commandStr);
      Object.keys(this).forEach((key) => packages[key] = this[key]);
      return packages;
    }
  }
}

export = ContainerItems;