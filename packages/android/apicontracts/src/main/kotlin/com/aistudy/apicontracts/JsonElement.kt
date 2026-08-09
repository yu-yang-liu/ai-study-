package com.aistudy.apicontracts

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

/**
 * Lenient JSON value helpers for untyped action payloads (mirrors iOS JSONValue / AnyCodable).
 * We rely on kotlinx.serialization.json.JsonElement directly as the value type rather than
 * wrapping it; the helpers below give typed access to loosely-typed payload maps.
 *
 * NOTE: Map<String, JsonElement> fields on @Serializable types are supported natively by
 * kotlinx.serialization — no custom KSerializer is required.
 */

/** Convenience helpers to read loosely-typed action payloads. */
fun JsonElement.asString(): String? = (this as? JsonPrimitive)?.let { it.contentOrNull }
fun JsonElement.asBoolean(): Boolean? = (this as? JsonPrimitive)?.booleanOrNull
fun JsonElement.asDouble(): Double? = (this as? JsonPrimitive)?.doubleOrNull
fun JsonElement.asObject(): Map<String, JsonElement>? = (this as? JsonObject)?.let { it }
fun JsonElement.asArray(): List<JsonElement>? = (this as? JsonArray)?.let { it }
