'use strict';

var expect = require('chai').expect;

var types = require('../cardInfoTypes');

var uuidReg = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

var File = types.File;
var Repository = types.Repository;
var MainRepository = types.MainRepository;
var Packages = types.Packages;
var Command = types.Command;
var SSHKey = types.SSHKey;

it('sanity checks', function () {
  expect(types).to.have.property('File');
  expect(types).to.have.property('Repository');
  expect(types).to.have.property('MainRepository');
  expect(types).to.have.property('Packages');
  expect(types).to.have.property('Command');
  expect(types).to.not.have.property('DockerfileItem');
  expect(types).to.not.have.property('ContainerItem');

  var file = new File();
  var repo = new Repository();
  var main = new MainRepository();
  expect(file.type).to.equal('File');
  expect(repo.type).to.equal('Repository');
  expect(main.type).to.equal('Main Repository');
});

describe('main constructor', function () {
  it('creates without a commandStr', function () {
    var file = new File();
    expect(file.id).to.match(uuidReg);
    expect(file).to.not.have.property('fromServer');
  });

  describe('only ADD', function () {
    it('should parse array syntax', function () {
      var cmdStr = 'ADD ["./asdf", "/"]';

      var file = new File(cmdStr);
      expect(file.fromServer).to.be.true;
      expect(file.id).to.match(uuidReg);
      expect(file.name).to.equal('asdf');
      expect(file.path).to.equal('');
      expect(file.commands).to.deep.equal([]);
      expect(file).to.not.have.property('hasFindReplace');
      expect(file).to.not.have.property('legacyADD');
    });
    it('should allow but warn on non-array syntax', function () {
      var cmdStr = 'ADD ./asdf /';

      var file = new File(cmdStr);

      expect(file.legacyADD).to.be.true;
    });
  });
  describe('ADD & commands', function () {
    it('should allow extra commands', function () {
      var cmdStr = [
        'ADD ["./asdf", "/"]',
        'WORKDIR /',
        'RUN apt-get install'
      ].join('\n');

      var file = new File(cmdStr);
      expect(file.fromServer).to.be.true;
      expect(file.id).to.match(uuidReg);
      expect(file.name).to.equal('asdf');
      expect(file.path).to.equal('');
      expect(file.commands[0].command).to.equal('RUN');
      expect(file.commands[0].body).to.equal('apt-get install');
      expect(file.commands[0].cache).to.be.false;
      expect(file).to.not.have.property('hasFindReplace');
      expect(file).to.not.have.property('legacyADD');
    });
  });
});

describe('toString', function () {
  it('array syntax', function () {
    var cmdStr = 'ADD ["./asdf", "/"]';

    var file = new File(cmdStr);

    expect(file.toString()).to.equal('#Start: File\n' + cmdStr + '\n#End');
  });
  it('should output array syntax even with legacy input', function () {
    var cmdStr = 'ADD ./asdf /';

    var file = new File(cmdStr);

    expect(file.toString()).to.equal('#Start: File\nADD ["./asdf", "/"]\n#End');
  });
  it('outputs WORKDIR when there are commands', function () {
    var cmdStr = [
      'ADD ["./asdf", "/"]',
      'WORKDIR /',
      'RUN apt-get install'
    ].join('\n');

    var file = new File(cmdStr);

    expect(file.toString()).to.equal('#Start: File\n' + cmdStr + '\n#End');
  });
  it('adds translation rules if needed', function () {
    var cmdStr = [
      'ADD ["./asdf", "/asdf"]',
      'WORKDIR /asdf',
      'ADD ./translation_rules.sh translation_rules.sh',
      'RUN bash translation_rules.sh',
      'RUN apt-get install'
    ].join('\n');

    var repo = new Repository(cmdStr);

    expect(repo.toString()).to.equal('#Start: Repository\n' + cmdStr + '\n#End');
  });
});

describe('caching', function () {
  it('notes the existence of the runnable-cache comment', function () {
    var cmdStr = [
      'ADD ["./asdf", "/"]',
      'WORKDIR /',
      'RUN apt-get install # runnable-cache'
    ].join('\n');

    var file = new File(cmdStr);

    expect(file.commands[0].command).to.equal('RUN');
    expect(file.commands[0].body).to.equal('apt-get install');
    expect(file.commands[0].cache).to.be.true;
  });
  it('appends # runnable-cache when we set cache to true', function () {
    var cmdStr = [
      'ADD ["./asdf", "/"]',
      'WORKDIR /',
      'RUN apt-get install'
    ].join('\n');

    var file = new File(cmdStr);

    file.commands[0].cache = true;


    var str = file.toString();

    expect(str).to.equal('#Start: File\n' + cmdStr + ' # runnable-cache\n#End');
  });
});

describe('Command', function () {
  it('throws an error without a proper command', function () {
    var cmdStr = 'Hello there';

    function throwing() {
      var cmd = new Command(cmdStr);
    }

    expect(throwing).to.throw(Error);
  });
  it('clones a new object', function () {
    var cmdStr = 'RUN apt-get install';

    var cmd0 = new Command(cmdStr);
    var cmd1 = cmd0.clone();

    expect(cmd1.command).to.equal(cmd0.command);
    expect(cmd1.body).to.equal(cmd0.body);
    expect(cmd1.cache).to.equal(cmd0.cache);
    expect(cmd0 === cmd1).to.be.false;
  });
  it('stringifies into an empty string when there is no body', function () {
    var cmdStr = 'RUN apt-get install';

    var cmd = new Command(cmdStr);
    cmd.body = '';

    expect(cmd.toString()).to.equal('');
  });
  it('sets the body to empty string when given an empty string', function () {
    var cmd = new Command('');
    expect(cmd.body).to.equal('');
    expect(cmd.cache).to.equal(false);
    expect(cmd.command).to.equal('');
  });
  it('sets the body to empty string when given nothing', function () {
    var cmd = new Command();
    expect(cmd.body).to.equal('');
    expect(cmd.cache).to.equal(false);
    expect(cmd.command).to.equal('');
  });
});

describe('Packages', function () {
  var packageList = 'test ssh dnsutils';
  var preamble = 'RUN apt-get update -y && apt-get upgrade -y && apt-get install -y ';
  it('should parse preoperly with a commandStr', function () {
    var packages = new Packages(preamble + packageList);
    expect(packages.packageList).to.equal(packageList);
  });
  it('should handle no commandStr', function () {
    var packages = new Packages();
    expect(packages.packageList).to.not.be.ok;
    expect(packages.toString()).to.equal('');
  });
  it('should clone properly', function () {
    var packages = new Packages(preamble + packageList);
    packages.packageList = 'test';
    var cloned = packages.clone();
    expect(cloned.packageList).to.equal('test');
  });
  it('should have a toString method that results in the preambled results', function () {
    var packages = new Packages(preamble + packageList);
    expect(packages.toString()).to.equal('#Start: Packages\n'+preamble + packageList+'\n#End');
  });
  it('should have a toString method that results in the preambled results and strip out newlines', function () {
    var packages = new Packages(preamble + packageList.split(' ').join(' \n\n'));
    expect(packages.toString()).to.equal('#Start: Packages\n'+preamble + packageList+'\n#End');
  });
});

describe('SSH Key', function () {
  it('should create a new SSH Key and toString to the right value', function () {
    var key = new SSHKey();
    key.name = 'test_key.id_rsa';

    expect(key.toString()).to.contain('ADD ["./test_key.id_rsa", "/root/.ssh/"]');
    expect(key.toString()).to.contain('RUN chmod 0500 test_key.id_rsa');
    expect(key.toString()).to.contain('echo "IdentityFile /root/.ssh/test_key.id_rsa" >> /etc/ssh/ssh_config');
    expect(key.toString()).to.contain('ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts');
  });
  it('should populate properly', function () {
    var key = new SSHKey(
      'ADD ["./test_key.id_rsa", "/root/.ssh/"]\n' +
      'WORKDIR /root/.ssh/\n'+
      'RUN chmod 0500 test_key.id_rsa && echo "IdentityFile /root/.ssh/test_key.id_rsa" >> /etc/ssh/ssh_config && ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts'
    );

    expect(key.name).to.equal('test_key.id_rsa');
  });
  it('should clone properly', function () {
    var key = new SSHKey();
    key.name = 'test_key.id_rsa';
    var clone = key.clone();
    expect(clone.name).to.equal('test_key.id_rsa');
  });
});