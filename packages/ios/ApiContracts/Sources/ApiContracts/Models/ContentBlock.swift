import Foundation

// MARK: - ContentBlock

/// 缁撴瀯鍖栧唴瀹瑰潡锛圥hase 1 Science AST锛夈€?
///
/// 鍥涚被瀛?AST 鏄犲皠锛堝榻?docs/SCIENCE_AST_IOS_ROADMAP.md锛夛細
/// - Text AST       鈫?`text` / `formula` / `image` / `table`
/// - Visual AST     鈫?`visual`锛圥hase 1 鍗犱綅锛汸hase 2 鐢?GeometryCanvasView 娓叉煋锛?
/// - Solution AST   鈫?`steps`锛堝彲灞曠ず鐨勮В棰樿建杩癸級
/// - Interaction AST鈫?`steps.interaction`锛堟姌鍙?/ 鍙€夋嫨绛変氦浜掑厓鏁版嵁锛?
///
/// 瑙ｇ爜瀹归敊锛?
/// - `formula` 缂?`latex` 鏃跺洖閫€ `content`锛堝吋瀹?OCR 鏃ф牸寮?formula-as-content锛夈€?
/// - `text` 缂?`content` 鏃堕檷绾т负绌轰覆銆?
/// - 鏈煡 `type` 闄嶇骇涓?`.text(content: "")`锛屽崟涓潖鍧椾笉浼氬鑷存暣鍝嶈В鐮佸け璐ャ€?
/// - `table` / `steps` 缂哄け鏍稿績鏁扮粍鏃堕檷绾т负绌猴紝淇濊瘉瀹㈡埛绔В鏋愮ǔ瀹氥€?
public enum ContentBlock: Codable, Sendable, Equatable {
    /// 鏅€氭枃鏈紙Markdown 鍐呰仈娓叉煋锛夈€?
    case text(content: String)
    /// 鏁板鍏紡锛堢函 LaTeX锛屾棤 `$` 鍖呰９锛夛紝浜?`FormulaView` 娓叉煋銆?
    case formula(latex: String)
    /// 鍥剧墖锛圥hase 1 鏋佸皯鍑虹幇锛涚ず鎰忓浘搴斾互 Visual AST 琛ㄨ揪锛屼笉渚濊禆鍥剧墖 URL锛夈€?
    case image(url: String, alt: String?)
    /// 琛ㄦ牸锛圱ext AST锛夈€?
    case table(headers: [String]?, rows: [[String]])
    /// 瑙ｉ姝ラ锛圫olution AST锛夛紝鍙€掑綊鍖呭惈鍏紡 / 琛ㄦ牸绛夊潡銆?
    case steps(title: String?, steps: [StepContent], interaction: InteractionHint?)
    /// 瑙嗚鍐呭锛圴isual AST锛夈€侾hase 2锛歚kind == "geometry"` 涓旀惡甯?`GeometryAST` 鏃讹紝
    /// 鐢?`GeometryCanvasView`锛圫wift Canvas/Shape锛夊姩鎬佹覆鏌擄紱鍚﹀垯鏄剧ず鍗犱綅銆?
    case visual(kind: String, geometry: GeometryAST?)
    /// 缁熻鍥捐〃锛圴isual AST 鎵╁睍 路 P1-1锛夛紝鐢?`ChartCanvasView` 娓叉煋銆?
    case chart(block: ChartBlock)
    /// 鐢佃矾鍥撅紙Visual AST 鎵╁睍 路 P1-2锛夛紝鐢?`CircuitCanvasView` 娓叉煋銆?
    case circuit(block: CircuitBlock)
    /// 閬椾紶绯昏氨鍥撅紙Visual AST 鎵╁睍 路 P1-4锛夛紝鐢?`PedigreeCanvasView` 娓叉煋銆?
    case pedigree(block: PedigreeBlock)
    /// 鍏崇郴鍥撅紙Visual AST 鎵╁睍 路 P1-4锛岄鐗╅摼/缃戯級锛岀敱 `GraphCanvasView` 娓叉煋銆?
    case graph(block: GraphBlock)
    /// 瀹為獙瑁呯疆鍥撅紙Visual AST 鎵╁睍 路 P2-1 鍖栧瀹為獙锛夛紝鐢?`LabCanvasView` 娓叉煋銆?
    case lab(block: LabBlock)
    case cell(block: CellBlock)
    case molecular(block: MolecularBlock)

    // MARK: CodingKeys

    private enum CodingKeys: String, CodingKey {
        case type
        case content
        case latex
        case url
        case alt
        case headers
        case rows
        case title
        case steps
        case interaction
        case kind
        case geometry
        case categories
        case series
        case points
        case bins
        case slices
        case xLabel
        case yLabel
        case nodes
        case wires
        case generations
        case marriages
        case edges
        case apparatus
        case connections
        case cellType
        case organelles
        case transport
        case atoms
        case bonds
    }

    // MARK: Decodable

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "text":
            let content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
            self = .text(content: content)
        case "formula":
            // 浼樺厛 latex锛岀己鐪佸洖閫€ content锛圤CR 鏃ф牸寮忔妸鍏紡鏀惧湪 content 瀛楁锛夈€?
            let latex = try container.decodeIfPresent(String.self, forKey: .latex)
                ?? (try container.decodeIfPresent(String.self, forKey: .content))
                ?? ""
            self = .formula(latex: latex)
        case "image":
            let url = try container.decodeIfPresent(String.self, forKey: .url) ?? ""
            let alt = try container.decodeIfPresent(String.self, forKey: .alt)
            self = .image(url: url, alt: alt)
        case "table":
            let headers = try container.decodeIfPresent([String].self, forKey: .headers)
            let rows = try container.decodeIfPresent([[String]].self, forKey: .rows) ?? []
            self = .table(headers: headers, rows: rows)
        case "steps":
            let title = try container.decodeIfPresent(String.self, forKey: .title)
            let steps = try container.decodeIfPresent([StepContent].self, forKey: .steps) ?? []
            let interaction = try container.decodeIfPresent(InteractionHint.self, forKey: .interaction)
            self = .steps(title: title, steps: steps, interaction: interaction)
        case "visual":
            let kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? "placeholder"
            let geometry = try container.decodeIfPresent(GeometryAST.self, forKey: .geometry)
            self = .visual(kind: kind, geometry: geometry)
        case "chart":
            if let block = try? ChartBlock(from: decoder) {
                self = .chart(block: block)
            } else {
                self = .text(content: "")
            }
        case "circuit":
            if let block = try? CircuitBlock(from: decoder) {
                self = .circuit(block: block)
            } else {
                self = .text(content: "")
            }
        case "pedigree":
            if let block = try? PedigreeBlock(from: decoder) {
                self = .pedigree(block: block)
            } else {
                self = .text(content: "")
            }
        case "graph":
            if let block = try? GraphBlock(from: decoder) {
                self = .graph(block: block)
            } else {
                self = .text(content: "")
            }
        case "lab":
            if let block = try? LabBlock(from: decoder) {
                self = .lab(block: block)
            } else {
                self = .text(content: "")
            }
        case "cell":
            if let block = try? CellBlock(from: decoder) {
                self = .cell(block: block)
            } else {
                self = .text(content: "")
            }
        case "molecular":
            if let block = try? MolecularBlock(from: decoder) {
                self = .molecular(block: block)
            } else {
                self = .text(content: "")
            }
        default:
            // 鏈煡 type 闄嶇骇涓虹┖鏂囨湰锛屼繚璇佹暣鍝嶅彲瑙ｇ爜銆?
            self = .text(content: "")
        }
    }

    // MARK: Encodable

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .text(let content):
            try container.encode("text", forKey: .type)
            try container.encode(content, forKey: .content)
        case .formula(let latex):
            try container.encode("formula", forKey: .type)
            try container.encode(latex, forKey: .latex)
        case .image(let url, let alt):
            try container.encode("image", forKey: .type)
            try container.encode(url, forKey: .url)
            try container.encodeIfPresent(alt, forKey: .alt)
        case .table(let headers, let rows):
            try container.encode("table", forKey: .type)
            try container.encodeIfPresent(headers, forKey: .headers)
            try container.encode(rows, forKey: .rows)
        case .steps(let title, let steps, let interaction):
            try container.encode("steps", forKey: .type)
            try container.encodeIfPresent(title, forKey: .title)
            try container.encode(steps, forKey: .steps)
            try container.encodeIfPresent(interaction, forKey: .interaction)
        case .visual(let kind, let geometry):
            try container.encode("visual", forKey: .type)
            try container.encode(kind, forKey: .kind)
            try container.encodeIfPresent(geometry, forKey: .geometry)
        case .chart(let block):
            try container.encode("chart", forKey: .type)
            try container.encode(block.kind, forKey: .kind)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encodeIfPresent(block.xLabel, forKey: .xLabel)
            try container.encodeIfPresent(block.yLabel, forKey: .yLabel)
            try container.encodeIfPresent(block.categories, forKey: .categories)
            try container.encodeIfPresent(block.series, forKey: .series)
            try container.encodeIfPresent(block.points, forKey: .points)
            try container.encodeIfPresent(block.bins, forKey: .bins)
            try container.encodeIfPresent(block.slices, forKey: .slices)
        case .circuit(let block):
            try container.encode("circuit", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.nodes, forKey: .nodes)
            try container.encode(block.wires, forKey: .wires)
        case .pedigree(let block):
            try container.encode("pedigree", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.generations, forKey: .generations)
            try container.encode(block.marriages, forKey: .marriages)
        case .graph(let block):
            try container.encode("graph", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.nodes, forKey: .nodes)
            try container.encode(block.edges, forKey: .edges)
        case .lab(let block):
            try container.encode("lab", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.apparatus, forKey: .apparatus)
            try container.encode(block.connections, forKey: .connections)
        case .cell(let block):
            try container.encode("cell", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.cellType, forKey: .cellType)
            try container.encode(block.organelles, forKey: .organelles)
            try container.encodeIfPresent(block.connections, forKey: .connections)
            try container.encodeIfPresent(block.transport, forKey: .transport)
        case .molecular(let block):
            try container.encode("molecular", forKey: .type)
            try container.encodeIfPresent(block.title, forKey: .title)
            try container.encode(block.atoms, forKey: .atoms)
            try container.encode(block.bonds, forKey: .bonds)
        }
    }
}

// MARK: - StepContent

/// 瑙ｉ姝ラ鍐呭锛圫olution AST 鍙跺瓙锛屽搴斿悗绔?`stepContentSchema`锛夈€?
public struct StepContent: Codable, Sendable, Equatable {
    /// 姝ラ鏍囬锛屽銆岀涓€姝ワ細鍖栫畝銆嶃€?
    public let title: String?
    /// 姝ラ鍐呭鍧楋紙鍙€掑綊鍖呭惈鍏紡 / 琛ㄦ牸绛夛級銆?
    public let blocks: [ContentBlock]
    /// 璇ユ楠ゅ閿欙紙鎵规敼鍦烘櫙锛夈€?
    public let isCorrect: Bool?
    /// 鑳藉姏鐐?/ 鏂规硶鏍囩锛屽銆岄厤鏂规硶銆嶃€?
    public let tag: String?

    private enum CodingKeys: String, CodingKey {
        case title
        case blocks
        case isCorrect
        case tag
    }

    public init(title: String? = nil, blocks: [ContentBlock], isCorrect: Bool? = nil, tag: String? = nil) {
        self.title = title
        self.blocks = blocks
        self.isCorrect = isCorrect
        self.tag = tag
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.title = try container.decodeIfPresent(String.self, forKey: .title)
        self.blocks = try container.decodeIfPresent([ContentBlock].self, forKey: .blocks) ?? []
        self.isCorrect = try container.decodeIfPresent(Bool.self, forKey: .isCorrect)
        self.tag = try container.decodeIfPresent(String.self, forKey: .tag)
    }
}

// MARK: - InteractionHint

/// Interaction AST锛圥hase 1 鏈€灏忓瓙闆嗭級锛氭姌鍙?/ 鍙€夋嫨銆?
public struct InteractionHint: Codable, Sendable, Equatable {
    /// 鏄惁鍙姌鍙犮€?
    public let collapsible: Bool?
    /// 鏄惁鍙€変腑姝ラ銆?
    public let selectable: Bool?

    public init(collapsible: Bool? = nil, selectable: Bool? = nil) {
        self.collapsible = collapsible
        self.selectable = selectable
    }
}
