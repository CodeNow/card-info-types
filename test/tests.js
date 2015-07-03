'use strict';

var expect = require('chai').expect;

var types = require('../cardInfoTypes');

var uuidReg = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

var File = types.File;
var Repository = types.Repository;
var MainRepository = types.MainRepository;
var Packages = types.Packages;

it('sanity checks', function () {
  expect(types).to.have.property('File');
  expect(types).to.have.property('Repository');
  expect(types).to.have.property('MainRepository');
  expect(types).to.have.property('Packages');
  expect(types).to.not.have.property('DockerfileItem');

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
      expect(file.commands).to.equal('');
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
      expect(file.commands).to.equal('apt-get install');
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

describe('Packages', function () {
  var packageList = 'test ssh dnsutils';
  var preamble = 'RUN apt-get update -y && apt-get upgrade -y && apt-get install ';
  it('should parse preoperly with a commandStr', function () {
    var packages = new Packages(preamble + packageList);
    expect(packages.packageList).to.equal(packageList);
  });
  it('should handle no commandStr', function () {
    var packages = new Packages();
    expect(packages.packageList).to.not.be.ok;
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