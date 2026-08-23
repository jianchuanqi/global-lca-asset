/** Durable browser presentation metadata for graph-bearing tool results. */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function graphPayload(value) {
    if (Array.isArray(value.nodes) && Array.isArray(value.relationships))
        return value;
    if (isObject(value.graph) && Array.isArray(value.graph.nodes) && Array.isArray(value.graph.relationships)) {
        return value.graph;
    }
    return undefined;
}
function node(value) {
    if (!isObject(value) || typeof value.uid !== 'string' || typeof value.name !== 'string')
        return undefined;
    if (!Array.isArray(value.labels) || !value.labels.every(label => typeof label === 'string'))
        return undefined;
    return {
        uid: value.uid,
        name: value.name,
        labels: value.labels,
        properties: isObject(value.properties) ? value.properties : {},
    };
}
function relationship(value) {
    if (!isObject(value))
        return undefined;
    if (typeof value.uid !== 'string'
        || typeof value.type !== 'string'
        || typeof value.start_uid !== 'string'
        || typeof value.end_uid !== 'string')
        return undefined;
    return {
        uid: value.uid,
        type: value.type,
        start_uid: value.start_uid,
        end_uid: value.end_uid,
        properties: isObject(value.properties) ? value.properties : {},
    };
}
/**
 * Extract the bounded graph result into session-log metadata. The browser reads
 * this copy directly, so replay never depends on reparsing model-facing text.
 */
export function graphPresentationMeta(value) {
    if (!isObject(value))
        return null;
    const graph = graphPayload(value);
    if (graph === undefined)
        return null;
    const nodes = graph.nodes.map(node).filter(item => item !== undefined);
    const relationships = graph.relationships
        .map(relationship)
        .filter(item => item !== undefined);
    const recordsSource = Array.isArray(value.records)
        ? value.records
        : Array.isArray(graph.records)
            ? graph.records
            : [];
    const records = recordsSource.filter(isObject);
    return {
        kind: 'global-lca-graph',
        version: 1,
        nodes,
        relationships,
        records,
        truncated: value.truncated === true,
        ...(typeof value.cypher === 'string' ? { cypher: value.cypher } : {}),
        ...(isObject(value.parameters) ? { parameters: value.parameters } : {}),
    };
}
//# sourceMappingURL=graph-presentation.js.map