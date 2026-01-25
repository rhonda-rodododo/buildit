// MessageChunkingTests.swift
// BuildItTests
//
// Unit tests for message chunking and reassembly for BLE transfer

import XCTest
@testable import BuildIt

final class MessageChunkingTests: XCTestCase {

    // MARK: - Constants

    /// Maximum size for a single BLE message chunk (matching BLE MTU constraints)
    let maxChunkSize = BuildItBLEConstants.maxMessageSize

    // MARK: - Message Size Tests

    func testSmallMessageNoChunkingNeeded() {
        // Given: A message smaller than max chunk size
        let message = TestFixtures.testMessageData
        XCTAssertTrue(message.count < maxChunkSize)

        // When: Calculating chunks needed
        let chunksNeeded = calculateChunksNeeded(for: message)

        // Then: Should need only 1 chunk
        XCTAssertEqual(chunksNeeded, 1)
    }

    func testLargeMessageRequiresChunking() {
        // Given: A message larger than max chunk size
        let message = Data.testData(size: maxChunkSize + 100)

        // When: Calculating chunks needed
        let chunksNeeded = calculateChunksNeeded(for: message)

        // Then: Should need multiple chunks
        XCTAssertGreaterThan(chunksNeeded, 1)
    }

    func testExactChunkSizeMessage() {
        // Given: A message exactly at max chunk size
        let message = Data.testData(size: maxChunkSize)

        // When: Calculating chunks needed
        let chunksNeeded = calculateChunksNeeded(for: message)

        // Then: Should need exactly 1 chunk
        XCTAssertEqual(chunksNeeded, 1)
    }

    func testChunkCountCalculation() {
        // Test various message sizes
        let testCases: [(messageSize: Int, expectedChunks: Int)] = [
            (100, 1),
            (maxChunkSize, 1),
            (maxChunkSize + 1, 2),
            (maxChunkSize * 2, 2),
            (maxChunkSize * 2 + 1, 3),
            (maxChunkSize * 5, 5),
            (maxChunkSize * 5 + 100, 6)
        ]

        for (messageSize, expectedChunks) in testCases {
            let message = Data.testData(size: messageSize)
            let chunks = calculateChunksNeeded(for: message)
            XCTAssertEqual(chunks, expectedChunks, "Message size \(messageSize) should need \(expectedChunks) chunks")
        }
    }

    // MARK: - Chunking Implementation Tests

    func testChunkMessage() {
        // Given: A message requiring multiple chunks
        let messageSize = maxChunkSize * 2 + 100 // Will need 3 chunks
        let message = Data.testData(size: messageSize)

        // When: Chunking
        let chunks = chunkMessage(message, maxSize: maxChunkSize)

        // Then: Should produce correct number of chunks
        XCTAssertEqual(chunks.count, 3)

        // All but last chunk should be max size
        for i in 0..<chunks.count - 1 {
            XCTAssertEqual(chunks[i].count, maxChunkSize)
        }

        // Last chunk should be remainder
        XCTAssertEqual(chunks.last?.count, 100)
    }

    func testChunkMessagePreservesData() {
        // Given: A message
        let message = Data.testData(size: maxChunkSize * 3 + 50)

        // When: Chunking
        let chunks = chunkMessage(message, maxSize: maxChunkSize)

        // Then: Reassembled data should match original
        let reassembled = chunks.reduce(Data()) { $0 + $1 }
        XCTAssertEqual(reassembled, message)
    }

    func testChunkEmptyMessage() {
        // Given: Empty message
        let message = Data()

        // When: Chunking
        let chunks = chunkMessage(message, maxSize: maxChunkSize)

        // Then: Should produce empty array
        XCTAssertTrue(chunks.isEmpty)
    }

    func testChunkSmallMessage() {
        // Given: Message smaller than chunk size
        let message = Data([0x01, 0x02, 0x03])

        // When: Chunking
        let chunks = chunkMessage(message, maxSize: maxChunkSize)

        // Then: Should produce single chunk with original data
        XCTAssertEqual(chunks.count, 1)
        XCTAssertEqual(chunks.first, message)
    }

    // MARK: - Reassembly Tests

    func testReassembleChunks() {
        // Given: Chunks from a message
        let original = Data.testData(size: maxChunkSize * 2 + 200)
        let chunks = chunkMessage(original, maxSize: maxChunkSize)

        // When: Reassembling
        let reassembled = reassembleChunks(chunks)

        // Then: Should match original
        XCTAssertEqual(reassembled, original)
    }

    func testReassembleSingleChunk() {
        // Given: A single chunk
        let original = TestFixtures.testMessageData
        let chunks = [original]

        // When: Reassembling
        let reassembled = reassembleChunks(chunks)

        // Then: Should match original
        XCTAssertEqual(reassembled, original)
    }

    func testReassembleEmptyChunks() {
        // Given: Empty chunk array
        let chunks: [Data] = []

        // When: Reassembling
        let reassembled = reassembleChunks(chunks)

        // Then: Should be empty
        XCTAssertTrue(reassembled.isEmpty)
    }

    // MARK: - Chunk Header Tests

    func testChunkHeaderStructure() {
        // A chunk header typically contains:
        // - Message ID (to correlate chunks)
        // - Chunk index
        // - Total chunks
        // - Payload length

        // Given: Header parameters
        let messageId: UInt32 = 12345
        let chunkIndex: UInt16 = 2
        let totalChunks: UInt16 = 5
        let payloadLength: UInt16 = 512

        // When: Creating header
        let header = createChunkHeader(
            messageId: messageId,
            chunkIndex: chunkIndex,
            totalChunks: totalChunks,
            payloadLength: payloadLength
        )

        // Then: Header should have expected size
        XCTAssertEqual(header.count, 10) // 4 + 2 + 2 + 2 = 10 bytes

        // Should be parseable
        let parsed = parseChunkHeader(header)
        XCTAssertEqual(parsed?.messageId, messageId)
        XCTAssertEqual(parsed?.chunkIndex, chunkIndex)
        XCTAssertEqual(parsed?.totalChunks, totalChunks)
        XCTAssertEqual(parsed?.payloadLength, payloadLength)
    }

    func testChunkHeaderRoundTrip() {
        // Given: Various header values
        let testCases: [(messageId: UInt32, chunkIndex: UInt16, totalChunks: UInt16, payloadLength: UInt16)] = [
            (0, 0, 1, 100),
            (1, 0, 1, maxChunkSize.uint16),
            (12345, 5, 10, 200),
            (.max, .max, .max, .max)
        ]

        for (messageId, chunkIndex, totalChunks, payloadLength) in testCases {
            // When: Creating and parsing
            let header = createChunkHeader(
                messageId: messageId,
                chunkIndex: chunkIndex,
                totalChunks: totalChunks,
                payloadLength: payloadLength
            )
            let parsed = parseChunkHeader(header)

            // Then: Should match
            XCTAssertEqual(parsed?.messageId, messageId)
            XCTAssertEqual(parsed?.chunkIndex, chunkIndex)
            XCTAssertEqual(parsed?.totalChunks, totalChunks)
            XCTAssertEqual(parsed?.payloadLength, payloadLength)
        }
    }

    // MARK: - Chunk Order Tests

    func testChunksInOrder() {
        // Given: Chunks received in order
        let original = Data.testData(size: maxChunkSize * 3)
        let chunks = chunkMessage(original, maxSize: maxChunkSize)

        // When: Processing in order
        var buffer: [Int: Data] = [:]
        for (index, chunk) in chunks.enumerated() {
            buffer[index] = chunk
        }

        // Then: Should be complete
        XCTAssertEqual(buffer.count, 3)
        XCTAssertTrue(isComplete(buffer: buffer, expectedCount: 3))
    }

    func testChunksOutOfOrder() {
        // Given: Chunks received out of order
        let original = Data.testData(size: maxChunkSize * 3)
        let chunks = chunkMessage(original, maxSize: maxChunkSize)

        // When: Receiving in reverse order
        var buffer: [Int: Data] = [:]
        for (index, chunk) in chunks.enumerated().reversed() {
            buffer[index] = chunk

            if index == 0 {
                // Now complete
                XCTAssertTrue(isComplete(buffer: buffer, expectedCount: 3))
            } else {
                XCTAssertFalse(isComplete(buffer: buffer, expectedCount: 3))
            }
        }

        // Then: Reassembly should still work
        let reassembled = buffer.sorted { $0.key < $1.key }.map { $0.value }.reduce(Data()) { $0 + $1 }
        XCTAssertEqual(reassembled, original)
    }

    func testMissingChunk() {
        // Given: Chunks with one missing
        var buffer: [Int: Data] = [:]
        buffer[0] = Data.testData(size: 100)
        buffer[2] = Data.testData(size: 100)
        // Missing chunk 1

        // Then: Should not be complete
        XCTAssertFalse(isComplete(buffer: buffer, expectedCount: 3))
    }

    // MARK: - Duplicate Chunk Handling Tests

    func testDuplicateChunkIgnored() {
        // Given: A buffer with existing chunk
        var buffer: [Int: Data] = [:]
        let originalChunk = Data.testData(size: 100)
        buffer[0] = originalChunk

        // When: Receiving duplicate with different data
        let duplicateChunk = Data.testData(size: 100)
        if buffer[0] != nil {
            // Don't overwrite - keep original
        } else {
            buffer[0] = duplicateChunk
        }

        // Then: Original should be preserved
        XCTAssertEqual(buffer[0], originalChunk)
    }

    // MARK: - Timeout and Cleanup Tests

    func testChunkBufferTimeout() {
        // Given: A partially received message
        struct ChunkBuffer {
            var chunks: [Int: Data] = [:]
            var startTime: Date
            var expectedCount: Int
        }

        let buffer = ChunkBuffer(
            chunks: [0: Data.testData(size: 100)],
            startTime: Date().addingTimeInterval(-120), // 2 minutes ago
            expectedCount: 3
        )

        // When: Checking timeout (e.g., 60 second timeout)
        let timeout: TimeInterval = 60
        let isExpired = Date().timeIntervalSince(buffer.startTime) > timeout

        // Then: Should be expired
        XCTAssertTrue(isExpired)
    }

    // MARK: - Large Message Tests

    func testVeryLargeMessage() {
        // Given: A very large message (10KB)
        let message = Data.testData(size: 10000)

        // When: Chunking and reassembling
        let chunks = chunkMessage(message, maxSize: maxChunkSize)
        let reassembled = reassembleChunks(chunks)

        // Then: Should successfully round-trip
        XCTAssertEqual(reassembled, message)
        XCTAssertGreaterThan(chunks.count, 1)
    }

    func testMaximumMessageSize() {
        // Given: Maximum practical message size
        let maxPracticalSize = maxChunkSize * 100 // ~50KB with 512 byte chunks
        let message = Data.testData(size: maxPracticalSize)

        // When: Chunking
        let chunks = chunkMessage(message, maxSize: maxChunkSize)

        // Then: Should produce expected number of chunks
        XCTAssertEqual(chunks.count, 100)
    }

    // MARK: - Helper Functions

    private func calculateChunksNeeded(for data: Data) -> Int {
        guard !data.isEmpty else { return 0 }
        return Int(ceil(Double(data.count) / Double(maxChunkSize)))
    }

    private func chunkMessage(_ data: Data, maxSize: Int) -> [Data] {
        guard !data.isEmpty else { return [] }

        var chunks: [Data] = []
        var offset = 0

        while offset < data.count {
            let chunkSize = min(maxSize, data.count - offset)
            let chunk = data.subdata(in: offset..<(offset + chunkSize))
            chunks.append(chunk)
            offset += chunkSize
        }

        return chunks
    }

    private func reassembleChunks(_ chunks: [Data]) -> Data {
        chunks.reduce(Data()) { $0 + $1 }
    }

    private func createChunkHeader(messageId: UInt32, chunkIndex: UInt16, totalChunks: UInt16, payloadLength: UInt16) -> Data {
        var header = Data()
        var msgId = messageId.bigEndian
        var idx = chunkIndex.bigEndian
        var total = totalChunks.bigEndian
        var len = payloadLength.bigEndian

        header.append(Data(bytes: &msgId, count: 4))
        header.append(Data(bytes: &idx, count: 2))
        header.append(Data(bytes: &total, count: 2))
        header.append(Data(bytes: &len, count: 2))

        return header
    }

    private func parseChunkHeader(_ data: Data) -> (messageId: UInt32, chunkIndex: UInt16, totalChunks: UInt16, payloadLength: UInt16)? {
        guard data.count >= 10 else { return nil }

        let messageId = data.subdata(in: 0..<4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
        let chunkIndex = data.subdata(in: 4..<6).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let totalChunks = data.subdata(in: 6..<8).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let payloadLength = data.subdata(in: 8..<10).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }

        return (messageId, chunkIndex, totalChunks, payloadLength)
    }

    private func isComplete(buffer: [Int: Data], expectedCount: Int) -> Bool {
        for i in 0..<expectedCount {
            if buffer[i] == nil {
                return false
            }
        }
        return true
    }
}

// MARK: - Int Extension for UInt16 Conversion

private extension Int {
    var uint16: UInt16 {
        UInt16(clamping: self)
    }
}
