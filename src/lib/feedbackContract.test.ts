import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_TIMEOUT_MS, analysisSchema, feedbackSchema, validateEvidence } from './feedbackContract';

const feedback = {summary:'Du sa 10 ord på en minut.',tips:[],positive:'Du avslutade med ett konkret förslag.'};
const sample = () => analysisSchema.parse({transcript:'Vi kan alltså börja nu.',metrics:{durationSeconds:60,wordsPerMinute:5,wordCount:5,fillers:[{word:'alltså',atSeconds:42}],pauses:[{start:30,duration:2}]},feedback});
test('analysis has a 20 second limit', () => assert.equal(ANALYSIS_TIMEOUT_MS, 20000));
test('feedback accepts at most three evidenced tips', () => {
  const tip = {text:'Vid 0:42: prova en paus.',quote:null,atSeconds:42};
  assert.equal(feedbackSchema.safeParse({...feedback,tips:[tip,tip,tip]}).success,true);
  assert.equal(feedbackSchema.safeParse({...feedback,tips:[tip,tip,tip,tip]}).success,false);
});
test('feedback rejects tips without quotes or times', () => assert.equal(feedbackSchema.safeParse({...feedback,tips:[{text:'Tala tydligare.',quote:null,atSeconds:null}]}).success,false));
test('feedback rejects invented quotes', () => {
  const result=sample();result.feedback.tips=[{text:'Undvik "eh".',quote:'eh',atSeconds:null}];
  assert.throws(()=>validateEvidence(result),/Citatet saknas/);
});
test('feedback must include its cited words in the tip', () => {
  const result=sample();result.feedback.tips=[{text:'Prova en paus.',quote:'alltså',atSeconds:null}];
  assert.throws(()=>validateEvidence(result),/ange citatet/);
});
test('feedback rejects events outside the recording', () => {
  const result=sample();result.metrics.pauses=[{start:59,duration:2}];
  assert.throws(()=>validateEvidence(result),/Pausen/);
});
test('feedback rejects emojis and generic praise', () => {
  assert.equal(feedbackSchema.safeParse({...feedback,positive:'Bra jobbat!'}).success,false);
  assert.equal(feedbackSchema.safeParse({...feedback,positive:'Du talade tydligt 🎉'}).success,false);
});
test('feedback summary cannot contain multiple sentences', () => assert.equal(feedbackSchema.safeParse({...feedback,summary:'Du talade snabbt. Du pausade.'}).success,false));