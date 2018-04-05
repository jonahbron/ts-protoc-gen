"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("../util");
var Printer_1 = require("../Printer");
var CodePrinter_1 = require("../CodePrinter");
var WellKnown_1 = require("../WellKnown");
var FieldTypes_1 = require("../ts/FieldTypes");
var plugin_pb_1 = require("google-protobuf/google/protobuf/compiler/plugin_pb");
function generateGrpcWebService(filename, descriptor, exportMap) {
    if (descriptor.getServiceList().length === 0) {
        return [];
    }
    return [
        createFile(generateTypescriptDefinition(descriptor, exportMap), filename + "_service.d.ts"),
        createFile(generateJavaScript(descriptor, exportMap), filename + "_service.js"),
    ];
}
exports.generateGrpcWebService = generateGrpcWebService;
function createFile(output, filename) {
    var file = new plugin_pb_1.CodeGeneratorResponse.File();
    file.setName(filename);
    file.setContent(output);
    return file;
}
function getCallingTypes(method, exportMap) {
    return {
        requestType: FieldTypes_1.getFieldType(FieldTypes_1.MESSAGE_TYPE, method.getInputType().slice(1), "", exportMap),
        responseType: FieldTypes_1.getFieldType(FieldTypes_1.MESSAGE_TYPE, method.getOutputType().slice(1), "", exportMap),
    };
}
function isUsed(fileDescriptor, pseudoNamespace, exportMap) {
    return fileDescriptor.getServiceList().some(function (service) {
        return service.getMethodList().some(function (method) {
            var callingTypes = getCallingTypes(method, exportMap);
            var namespacePackage = pseudoNamespace + ".";
            return (callingTypes.requestType.indexOf(namespacePackage) === 0 ||
                callingTypes.responseType.indexOf(namespacePackage) === 0);
        });
    });
}
var RPCDescriptor = (function () {
    function RPCDescriptor(grpcService, protoService, exportMap) {
        this.grpcService = grpcService;
        this.protoService = protoService;
        this.exportMap = exportMap;
    }
    Object.defineProperty(RPCDescriptor.prototype, "name", {
        get: function () {
            return this.protoService.getName();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RPCDescriptor.prototype, "qualifiedName", {
        get: function () {
            return (this.grpcService.packageName ? this.grpcService.packageName + "." : "") + this.name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RPCDescriptor.prototype, "methods", {
        get: function () {
            var _this = this;
            return this.protoService.getMethodList()
                .map(function (method) {
                var callingTypes = getCallingTypes(method, _this.exportMap);
                return {
                    name: method.getName(),
                    serviceName: _this.name,
                    requestStream: method.getClientStreaming(),
                    responseStream: method.getServerStreaming(),
                    requestType: callingTypes.requestType,
                    responseType: callingTypes.responseType,
                };
            });
        },
        enumerable: true,
        configurable: true
    });
    return RPCDescriptor;
}());
var GrpcWebServiceDescriptor = (function () {
    function GrpcWebServiceDescriptor(fileDescriptor, exportMap) {
        this.fileDescriptor = fileDescriptor;
        this.exportMap = exportMap;
        this.pathToRoot = util_1.getPathToRoot(fileDescriptor.getName());
    }
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "filename", {
        get: function () {
            return this.fileDescriptor.getName();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "packageName", {
        get: function () {
            return this.fileDescriptor.getPackage();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "imports", {
        get: function () {
            var _this = this;
            var dependencies = this.fileDescriptor.getDependencyList()
                .filter(function (dependency) { return isUsed(_this.fileDescriptor, util_1.filePathToPseudoNamespace(dependency), _this.exportMap); })
                .map(function (dependency) {
                var namespace = util_1.filePathToPseudoNamespace(dependency);
                if (dependency in WellKnown_1.WellKnownTypesMap) {
                    return {
                        namespace: namespace,
                        path: WellKnown_1.WellKnownTypesMap[dependency],
                    };
                }
                else {
                    return {
                        namespace: namespace,
                        path: "" + _this.pathToRoot + util_1.filePathFromProtoWithoutExtension(util_1.filePathFromProtoWithoutExtension(dependency))
                    };
                }
            });
            var hostProto = {
                namespace: util_1.filePathToPseudoNamespace(this.filename),
                path: "" + this.pathToRoot + util_1.filePathFromProtoWithoutExtension(this.filename),
            };
            return [hostProto].concat(dependencies);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "services", {
        get: function () {
            var _this = this;
            return this.fileDescriptor.getServiceList()
                .map(function (service) {
                return new RPCDescriptor(_this, service, _this.exportMap);
            });
        },
        enumerable: true,
        configurable: true
    });
    return GrpcWebServiceDescriptor;
}());
function generateTypescriptDefinition(fileDescriptor, exportMap) {
    var serviceDescriptor = new GrpcWebServiceDescriptor(fileDescriptor, exportMap);
    var printer = new Printer_1.Printer(0);
    printer.printLn("// package: " + serviceDescriptor.packageName);
    printer.printLn("// file: " + serviceDescriptor.filename);
    printer.printEmptyLn();
    printer.printLn("import {grpc} from \"grpc-web-client\";");
    serviceDescriptor.imports
        .forEach(function (importDescriptor) {
        printer.printLn("import * as " + importDescriptor.namespace + " from \"" + importDescriptor.path + "\";");
    });
    printer.printEmptyLn();
    serviceDescriptor.services
        .forEach(function (service) {
        service.methods.forEach(function (method) {
            printer.printLn("type " + method.serviceName + method.name + " = {");
            printer.printIndentedLn("readonly methodName: string;");
            printer.printIndentedLn("readonly service: typeof " + method.serviceName + ";");
            printer.printIndentedLn("readonly requestStream: " + method.requestStream + ";");
            printer.printIndentedLn("readonly responseStream: " + method.responseStream + ";");
            printer.printIndentedLn("readonly requestType: typeof " + method.requestType + ";");
            printer.printIndentedLn("readonly responseType: typeof " + method.responseType + ";");
            printer.printLn("};");
            printer.printEmptyLn();
        });
        printer.printLn("export class " + service.name + " {");
        printer.printIndentedLn("static readonly serviceName: string;");
        service.methods.forEach(function (method) {
            printer.printIndentedLn("static readonly " + method.name + ": " + method.serviceName + method.name + ";");
        });
        printer.printLn("}");
        printer.printEmptyLn();
    });
    printer.printLn("export type ServerStreamEventType = 'data'|'end';");
    serviceDescriptor.services
        .forEach(function (service) {
        printServiceStubTypes(printer, service);
    });
    return printer.getOutput();
}
function generateJavaScript(fileDescriptor, exportMap) {
    var serviceDescriptor = new GrpcWebServiceDescriptor(fileDescriptor, exportMap);
    var printer = new Printer_1.Printer(0);
    printer.printLn("// package: " + serviceDescriptor.packageName);
    printer.printLn("// file: " + serviceDescriptor.filename);
    printer.printEmptyLn();
    serviceDescriptor.imports
        .forEach(function (importDescriptor) {
        printer.printLn("var " + importDescriptor.namespace + " = require(\"" + importDescriptor.path + "\");");
    });
    printer.printEmptyLn();
    serviceDescriptor.services
        .forEach(function (service) {
        printer.printLn("var " + service.name + " = (function () {");
        printer.printIndentedLn("function " + service.name + "() {}");
        printer.printIndentedLn(service.name + ".serviceName = \"" + service.qualifiedName + "\";");
        printer.printIndentedLn("return " + service.name + ";");
        printer.printLn("}());");
        printer.printEmptyLn();
        service.methods
            .forEach(function (method) {
            printer.print(method.serviceName + "." + method.name + " = {");
            printer.printIndentedLn("methodName: \"" + method.name + "\",");
            printer.printIndentedLn("service: " + method.serviceName + ",");
            printer.printIndentedLn("requestStream: " + method.requestStream + ",");
            printer.printIndentedLn("responseStream: " + method.responseStream + ",");
            printer.printIndentedLn("requestType: " + method.requestType + ",");
            printer.printIndentedLn("responseType: " + method.responseType);
            printer.printLn("};");
            printer.printEmptyLn();
        });
        printer.printLn("exports." + service.name + " = " + service.name + ";");
        printer.printEmptyLn();
        printServiceStub(printer, service);
        printer.printEmptyLn();
    });
    return printer.getOutput();
}
function printServiceStub(methodPrinter, service) {
    var printer = new CodePrinter_1.CodePrinter(0, methodPrinter);
    printer
        .printLn("function " + service.name + "Client(serviceHost) {")
        .indent().printLn("this.serviceHost = serviceHost;")
        .dedent().printLn("}");
    service.methods.forEach(function (method) {
        var camelCaseMethodName = method.name[0].toLowerCase() + method.name.substr(1);
        if (method.requestStream && method.responseStream) {
            printBidirectionalStubMethod(printer, service, camelCaseMethodName);
        }
        else if (method.requestStream) {
            printClientStreamStubMethod(printer, service, camelCaseMethodName);
        }
        else if (method.responseStream) {
            printServerStreamStubMethod(printer, service, method, camelCaseMethodName);
        }
        else {
            printUnaryStubMethod(printer, service, method, camelCaseMethodName);
        }
    });
    printer.printLn("exports." + service.name + "Client = " + service.name + "Client;");
}
function printUnaryStubMethod(printer, service, method, camelCaseMethodName) {
    printer
        .printLn(service.name + "Client.prototype." + camelCaseMethodName + " = function " + camelCaseMethodName + "(")
        .indent().printLn("requestMessage,")
        .printLn("metadata,")
        .printLn("callback")
        .dedent().printLn(") {")
        .indent().printLn("grpc.unary(" + service.name + "." + method.name + ", {")
        .indent().printLn("request: requestMessage,")
        .printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("onEnd: function (response) {")
        .indent().printLn("if (callback) {")
        .indent().printLn("var responseMessage = response.message;")
        .printLn("if (response.status !== grpc.Code.OK) {")
        .indent().printLn("return callback(response, null);")
        .dedent().printLn("} else {")
        .indent().printLn("callback(null, responseMessage);")
        .dedent().printLn("}")
        .dedent().printLn("}")
        .dedent().printLn("}")
        .dedent().printLn("});")
        .dedent().printLn("}");
}
function printServerStreamStubMethod(printer, service, method, camelCaseMethodName) {
    printer
        .printLn(service.name + "Client.prototype." + camelCaseMethodName + " = function " + camelCaseMethodName + "(requestMessage, metadata) {")
        .indent().printLn("var listeners = {")
        .indent().printLn("data: [],")
        .printLn("end: []")
        .dedent().printLn("};")
        .printLn("grpc.invoke(" + service.name + "." + method.name + ", {")
        .indent().printLn("request: requestMessage,")
        .printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("onMessage: function (responseMessage) {")
        .indent().printLn("listeners.data.forEach(function (callback) {")
        .indent().printLn("callback(responseMessage);")
        .dedent().printLn("});")
        .dedent().printLn("},")
        .printLn("onEnd: function () {")
        .indent().printLn("listeners.end.forEach(function (callback) {")
        .indent().printLn("callback();")
        .dedent().printLn("});")
        .dedent().printLn("}")
        .dedent().printLn("});")
        .printLn("return {")
        .indent().printLn("on: function (eventType, callback) {")
        .indent().printLn("listeners[eventType] = callback;")
        .dedent().printLn("}")
        .dedent().printLn("};");
}
function printBidirectionalStubMethod(printer, service, camelCaseMethodName) {
    printer
        .printLn(service.name + ".prototype." + camelCaseMethodName + " = function " + camelCaseMethodName + "() {")
        .indent().printLn("throw new Error(\"Client streaming is not currently supported\");")
        .dedent().printLn("}");
}
function printClientStreamStubMethod(printer, service, camelCaseMethodName) {
    printer
        .printLn(service.name + ".prototype." + camelCaseMethodName + " = function " + camelCaseMethodName + "() {")
        .indent().printLn("throw new Error(\"Bi-directional streaming is not currently supported\");")
        .dedent().printLn("}");
}
function printServiceStubTypes(methodPrinter, service) {
    var printer = new CodePrinter_1.CodePrinter(0, methodPrinter);
    printer
        .printLn("export class " + service.name + "Client {")
        .indent().printLn("serviceHost: string;")
        .printLn("constructor(serviceHost: string);");
    service.methods.forEach(function (method) {
        var camelCaseMethodName = method.name[0].toLowerCase() + method.name.substr(1);
        if (method.requestStream && method.responseStream) {
            printBidirectionalStubMethodTypes(printer, camelCaseMethodName);
        }
        else if (method.requestStream) {
            printClientStreamStubMethodTypes(printer, camelCaseMethodName);
        }
        else if (method.responseStream) {
            printServerStreamStubMethodTypes(printer, method, camelCaseMethodName);
        }
        else {
            printUnaryStubMethodTypes(printer, method, camelCaseMethodName);
        }
    });
    printer.dedent().printLn("}");
}
function printUnaryStubMethodTypes(printer, method, camelCaseMethodName) {
    printer
        .printLn(camelCaseMethodName + "(")
        .indent().printLn("requestMessage: " + method.requestType + ",")
        .printLn("metadata?: grpc.Metadata,")
        .printLn("callback?: (error: any, responseMessage: " + method.responseType + "|null) => void")
        .dedent().printLn("): void;");
}
function printServerStreamStubMethodTypes(printer, method, camelCaseMethodName) {
    printer.printLn(camelCaseMethodName + "(requestMessage: " + method.requestType + ", metadata?: grpc.Metadata): any;");
}
function printBidirectionalStubMethodTypes(printer, camelCaseMethodName) {
    printer.printLn(camelCaseMethodName + "(): void;");
}
function printClientStreamStubMethodTypes(printer, camelCaseMethodName) {
    printer.printLn(camelCaseMethodName + "(): void;");
}
//# sourceMappingURL=grpcweb.js.map