import { describe, it, expect } from "vitest";
import {
  ENTITY_MAP,
  MASKING_METHOD_MAP,
  TRANSCRIPTION_MAP,
  isValidEntity,
  getEntityEnum,
  getMaskingMethodEnum,
  getTranscriptionEnum,
} from "../../../src/lib/mappings/entityMaps";
import { DetectEntities, MaskingMethod, DetectOutputTranscription } from "skyflow-node";

describe("Entity Mappings", () => {
  describe("ENTITY_MAP", () => {
    it("should contain all expected entity types", () => {
      const expectedEntities = [
        "age",
        "bank_account",
        "credit_card",
        "email_address",
        "phone_number",
        "ssn",
        "name",
        "dob",
        "driver_license",
        "all",
      ];

      expectedEntities.forEach((entity) => {
        expect(ENTITY_MAP).toHaveProperty(entity);
      });
    });

    it("should have exactly 69 entity mappings", () => {
      expect(Object.keys(ENTITY_MAP)).toHaveLength(69);
    });

    it("should map common entities correctly", () => {
      expect(ENTITY_MAP.email_address).toBe(DetectEntities.EMAIL_ADDRESS);
      expect(ENTITY_MAP.phone_number).toBe(DetectEntities.PHONE_NUMBER);
      expect(ENTITY_MAP.ssn).toBe(DetectEntities.SSN);
      expect(ENTITY_MAP.credit_card).toBe(DetectEntities.CREDIT_CARD);
      expect(ENTITY_MAP.all).toBe(DetectEntities.ALL);
    });

    it("should map medical entities correctly", () => {
      expect(ENTITY_MAP.blood_type).toBe(DetectEntities.BLOOD_TYPE);
      expect(ENTITY_MAP.condition).toBe(DetectEntities.CONDITION);
      expect(ENTITY_MAP.drug).toBe(DetectEntities.DRUG);
      expect(ENTITY_MAP.medical_code).toBe(DetectEntities.MEDICAL_CODE);
    });

    it("should map location entities correctly", () => {
      expect(ENTITY_MAP.location).toBe(DetectEntities.LOCATION);
      expect(ENTITY_MAP.location_address).toBe(DetectEntities.LOCATION_ADDRESS);
      expect(ENTITY_MAP.location_city).toBe(DetectEntities.LOCATION_CITY);
      expect(ENTITY_MAP.location_state).toBe(DetectEntities.LOCATION_STATE);
      expect(ENTITY_MAP.location_zip).toBe(DetectEntities.LOCATION_ZIP);
    });
  });

  describe("MASKING_METHOD_MAP", () => {
    it("should contain BLACKBOX and BLUR methods", () => {
      expect(MASKING_METHOD_MAP.BLACKBOX).toBe(MaskingMethod.Blackbox);
      expect(MASKING_METHOD_MAP.BLUR).toBe(MaskingMethod.Blur);
    });

    it("should have exactly 2 masking methods", () => {
      expect(Object.keys(MASKING_METHOD_MAP)).toHaveLength(2);
    });
  });

  describe("TRANSCRIPTION_MAP", () => {
    it("should contain transcription types", () => {
      expect(TRANSCRIPTION_MAP.PLAINTEXT_TRANSCRIPTION).toBe(
        DetectOutputTranscription.PLAINTEXT_TRANSCRIPTION
      );
      expect(TRANSCRIPTION_MAP.DIARIZED_TRANSCRIPTION).toBe(
        DetectOutputTranscription.DIARIZED_TRANSCRIPTION
      );
    });

    it("should have exactly 2 transcription types", () => {
      expect(Object.keys(TRANSCRIPTION_MAP)).toHaveLength(2);
    });
  });

  describe("isValidEntity()", () => {
    it("should return true for valid entities", () => {
      expect(isValidEntity("email_address")).toBe(true);
      expect(isValidEntity("phone_number")).toBe(true);
      expect(isValidEntity("ssn")).toBe(true);
      expect(isValidEntity("all")).toBe(true);
    });

    it("should return false for invalid entities", () => {
      expect(isValidEntity("invalid_entity")).toBe(false);
      expect(isValidEntity("")).toBe(false);
      expect(isValidEntity("EMAIL_ADDRESS")).toBe(false); // Case sensitive
    });
  });

  describe("getEntityEnum()", () => {
    it("should return correct enum for valid entities", () => {
      expect(getEntityEnum("email_address")).toBe(DetectEntities.EMAIL_ADDRESS);
      expect(getEntityEnum("phone_number")).toBe(DetectEntities.PHONE_NUMBER);
      expect(getEntityEnum("ssn")).toBe(DetectEntities.SSN);
    });

    it("should throw error for invalid entities", () => {
      expect(() => getEntityEnum("invalid_entity")).toThrow(
        "Invalid entity type: invalid_entity"
      );
      expect(() => getEntityEnum("")).toThrow("Invalid entity type: ");
    });
  });

  describe("getMaskingMethodEnum()", () => {
    it("should return correct enum for valid masking methods", () => {
      expect(getMaskingMethodEnum("BLACKBOX")).toBe(MaskingMethod.Blackbox);
      expect(getMaskingMethodEnum("BLUR")).toBe(MaskingMethod.Blur);
    });

    it("should throw error for invalid masking methods", () => {
      expect(() => getMaskingMethodEnum("INVALID")).toThrow(
        "Invalid masking method: INVALID"
      );
      expect(() => getMaskingMethodEnum("blackbox")).toThrow(
        "Invalid masking method: blackbox"
      ); // Case sensitive
    });
  });

  describe("getTranscriptionEnum()", () => {
    it("should return correct enum for valid transcription types", () => {
      expect(getTranscriptionEnum("PLAINTEXT_TRANSCRIPTION")).toBe(
        DetectOutputTranscription.PLAINTEXT_TRANSCRIPTION
      );
      expect(getTranscriptionEnum("DIARIZED_TRANSCRIPTION")).toBe(
        DetectOutputTranscription.DIARIZED_TRANSCRIPTION
      );
    });

    it("should throw error for invalid transcription types", () => {
      expect(() => getTranscriptionEnum("INVALID")).toThrow(
        "Invalid transcription type: INVALID"
      );
    });
  });
});
