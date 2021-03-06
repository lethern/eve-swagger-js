jest.mock('../../../internal/esi-agent');

import { API, makeAPI } from '../../../index';
import { ESIAgent } from '../../../internal/esi-agent';

let api: API = makeAPI();
// Cast to any to get the private agent property
let agent: ESIAgent = (api as any).agent;

afterEach(() => {
  agent.__reset();
});

test('Contact.del', () => {
  agent.__expectRoute('delete_characters_character_id_contacts', {
    'character_id': 1, 'contact_ids': [2]
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts(2).del().then(result => {
    expect(result).not.toBeDefined();
  });
});

test('Contact.update', () => {
  agent.__expectRoute('put_characters_character_id_contacts', {
    'character_id': 1,
    'contact_ids': [2],
    'watched': false,
    'standing': 3.5,
    'label_id': 3
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts(2).update(3.5, 3)
  .then(result => {
    expect(result).not.toBeDefined();
  });
});

test('Contact.updateWatched', () => {
  agent.__expectRoute('put_characters_character_id_contacts', {
    'character_id': 1,
    'contact_ids': [2],
    'watched': true,
    'standing': 3.5,
    'label_id': 3
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts(2).updateWatched(3.5, 3)
  .then(result => {
    expect(result).not.toBeDefined();
  });
});

test('Contacts.add', () => {
  agent.__expectRoute('post_characters_character_id_contacts', {
    'character_id': 1,
    'contact_ids': [2, 3],
    'watched': false,
    'standing': 3.5,
    'label_id': 3
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts.add([2, 3], 3.5, 3)
  .then(result => {
    expect(result).toBeDefined();
  });
});

test('Contacts.addWatched', () => {
  agent.__expectRoute('post_characters_character_id_contacts', {
    'character_id': 1,
    'contact_ids': [2, 3],
    'watched': true,
    'standing': 3.5,
    'label_id': 3
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts.addWatched([2, 3], 3.5, 3)
  .then(result => {
    expect(result).toBeDefined();
  });
});

test('Contacts.labels', () => {
  agent.__expectRoute('get_characters_character_id_contacts_labels', {
    'character_id': 1
  }, { token: 'my_token' });
  return api.characters(1, 'my_token').contacts.labels().then(result => {
    expect(result).toBeDefined();
  });
});

test('Contacts.all', () => {
  agent.__expectRoute('get_characters_character_id_contacts', {
    'character_id': 1, 'page': 1
  }, { token: 'my_token' });
  agent.__expectRoute('get_characters_character_id_contacts', {
    'character_id': 1, 'page': 2
  }, {
    token: 'my_token', returns: []
  });

  return api.characters(1, 'my_token').contacts().then(result => {
    expect(result).toBeDefined();
  });
});
