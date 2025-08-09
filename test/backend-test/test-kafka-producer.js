const { describe, test } = require("node:test");
const assert = require("node:assert");
const { kafkaProducerAsync } = require("../../server/util-server");

/**
 * Creates a Kafka factory stub that fails connect if the first broker equals a specific value.
 * @param {string} failingFirstBroker - broker (host:port) that should fail when first in the list
 * @param {Set<string>} alwaysFailBrokers - brokers that always fail regardless of position
 */
function createKafkaFactoryStub(failingFirstBroker, alwaysFailBrokers = new Set()) {
    return (config) => {
        return {
            producer: () => {
                return {
                    async connect() {
                        const first = Array.isArray(config.brokers) ? config.brokers[0] : config.brokers;
                        if (alwaysFailBrokers.has(first)) {
                            throw new Error(`Broker down: ${first}`);
                        }
                        if (first === failingFirstBroker) {
                            throw new Error(`Broker down: ${first}`);
                        }
                    },
                    async send() {
                        return;
                    },
                    async disconnect() {
                        return;
                    },
                };
            },
        };
    };
}

describe("kafkaProducerAsync", () => {
    test("rotates brokers and succeeds when first broker is down but another is up", async () => {
        const brokers = ["bad:9092", "good:9092", "other:9092"]; // first is down
        const options = {
            interval: 5, // seconds
            kafkaFactory: createKafkaFactoryStub("bad:9092"),
        };

        const result = await kafkaProducerAsync(brokers, "topic", "msg", options, {});
        assert.strictEqual(result, "Message sent successfully");
    });

    test("fails when all brokers are down", async () => {
        const brokers = ["bad:9092", "worse:9092"]; // all down
        const down = new Set(brokers);
        const options = {
            interval: 2, // seconds
            kafkaFactory: createKafkaFactoryStub("bad:9092", down),
        };

        await assert.rejects(
            kafkaProducerAsync(brokers, "topic", "msg", options, {}),
            (err) => /Failed to connect to any Kafka broker/.test(err.message)
        );
    });
});


