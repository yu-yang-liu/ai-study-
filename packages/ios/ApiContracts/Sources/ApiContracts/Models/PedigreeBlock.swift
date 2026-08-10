import Foundation

/// 系谱个体（世代行内的符号：□ 男 / ○ 女，实心患病等）。
public struct PedigreeIndividual: Codable, Sendable, Equatable {
    public let id: String
    public let gender: String?
    public let affected: Bool?
    public let carrier: Bool?
    public let deceased: Bool?
    public let label: String?
    public let proband: Bool?

    public init(
        id: String,
        gender: String? = nil,
        affected: Bool? = nil,
        carrier: Bool? = nil,
        deceased: Bool? = nil,
        label: String? = nil,
        proband: Bool? = nil
    ) {
        self.id = id
        self.gender = gender
        self.affected = affected
        self.carrier = carrier
        self.deceased = deceased
        self.label = label
        self.proband = proband
    }
}

/// 婚姻（配偶二人 + 子女列表）。
public struct PedigreeMarriage: Codable, Sendable, Equatable {
    public let spouses: [String]
    public let children: [String]?

    public init(spouses: [String], children: [String]? = nil) {
        self.spouses = spouses
        self.children = children
    }
}

/// 世代行。
public struct PedigreeGeneration: Codable, Sendable, Equatable {
    public let label: String?
    public let individuals: [PedigreeIndividual]

    public init(label: String?, individuals: [PedigreeIndividual]) {
        self.label = label
        self.individuals = individuals
    }
}

/// 遗传系谱图（P1-4 · Visual AST 扩展）。
public struct PedigreeBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let generations: [PedigreeGeneration]
    public let marriages: [PedigreeMarriage]

    public init(title: String?, generations: [PedigreeGeneration], marriages: [PedigreeMarriage]) {
        self.title = title
        self.generations = generations
        self.marriages = marriages
    }
}
