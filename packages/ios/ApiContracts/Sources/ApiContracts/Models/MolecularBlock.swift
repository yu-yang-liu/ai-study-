import Foundation

public struct MolecularAtom: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let symbol: String
    public let x: Double
    public let y: Double
    public let charge: Int?
    public let label: String?

    public init(
        id: String,
        symbol: String,
        x: Double,
        y: Double,
        charge: Int? = nil,
        label: String? = nil
    ) {
        self.id = id
        self.symbol = symbol
        self.x = x
        self.y = y
        self.charge = charge
        self.label = label
    }
}

public struct MolecularBond: Codable, Sendable, Equatable {
    public let from: String
    public let to: String
    public let order: Int

    public init(from: String, to: String, order: Int = 1) {
        self.from = from
        self.to = to
        self.order = order
    }
}

public struct MolecularBlock: Codable, Sendable, Equatable {
    public let title: String?
    public let atoms: [MolecularAtom]
    public let bonds: [MolecularBond]

    public init(title: String? = nil, atoms: [MolecularAtom], bonds: [MolecularBond]) {
        self.title = title
        self.atoms = atoms
        self.bonds = bonds
    }
}
