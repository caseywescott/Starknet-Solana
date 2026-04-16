//! KojiComposer — PRD §5.1 (v0.2). Stores composition params and derives MIDI on read.

use starknet::ContractAddress;
use koji::midi::types::Modes;

#[derive(Drop, Serde, starknet::Store)]
pub struct CompositionData {
    pub seed: u256,
    pub scale: u8,
    pub rhythm_density: u8,
    pub bpm: u16,
    pub composer_starknet: ContractAddress,
    pub composer_solana: felt252,
    pub block_number: u64,
    pub composition_id: u256,
}

#[derive(Drop, starknet::Event)]
pub struct CompositionMinted {
    #[key]
    pub composition_id: u256,
    #[key]
    pub composer_starknet: ContractAddress,
    pub composer_solana: felt252,
    pub seed: u256,
    pub scale: u8,
    pub rhythm_density: u8,
    pub bpm: u16,
    pub block_number: u64,
}

#[starknet::interface]
pub trait IKojiComposer<TContractState> {
    fn compose_and_mint(
        ref self: TContractState,
        seed: u256,
        scale: u8,
        rhythm_density: u8,
        bpm: u16,
        solana_recipient: felt252,
    ) -> u256;
    fn get_composition(self: @TContractState, composition_id: u256) -> CompositionData;
    fn get_composition_midi(self: @TContractState, composition_id: u256) -> Array<felt252>;
    fn get_composer_compositions(self: @TContractState, composer: ContractAddress) -> Array<u256>;
    fn composition_count(self: @TContractState) -> u256;
}

fn scale_to_mode(scale: u8) -> Modes {
    match scale {
        0_u8 => Modes::Major(()),
        1_u8 => Modes::Minor(()),
        2_u8 => Modes::Dorian(()),
        3_u8 => Modes::Phrygian(()),
        4_u8 => Modes::Lydian(()),
        5_u8 => Modes::Mixolydian(()),
        _ => Modes::Locrian(()),
    }
}

#[starknet::contract]
pub mod KojiComposer {
    use super::{CompositionData, CompositionMinted, IKojiComposer, scale_to_mode};
    use crate::bridge::{IKojiBridgeDispatcher, IKojiBridgeDispatcherTrait};
    use core::traits::TryInto;
    use core::option::Option;
    use koji::midi::core::MidiTrait;
    use koji::midi::euclidean::euclidean;
    use koji::midi::modes::mode_steps;
    use koji::midi::output::{output_midi_object, to_felt252_array};
    use koji::midi::pitch::pc_to_keynum;
    use koji::midi::types::{Message, Midi, NoteOff, NoteOn, PitchClass, ProgramChange, SetTempo};
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{get_block_number, get_caller_address};

    #[storage]
    struct Storage {
        composition_count: u256,
        compositions: Map<u256, CompositionData>,
        bridge_address: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CompositionMinted: CompositionMinted,
    }

    #[constructor]
    fn constructor(ref self: ContractState, bridge_address: ContractAddress) {
        self.bridge_address.write(bridge_address);
    }

    #[abi(embed_v0)]
    impl KojiComposerImpl of IKojiComposer<ContractState> {
        fn compose_and_mint(
            ref self: ContractState,
            seed: u256,
            scale: u8,
            rhythm_density: u8,
            bpm: u16,
            solana_recipient: felt252,
        ) -> u256 {
            assert!(scale <= 6_u8, "scale");
            assert!(rhythm_density >= 1_u8 && rhythm_density <= 16_u8, "density");
            assert!(bpm >= 60_u16 && bpm <= 240_u16, "bpm");

            let composition_id = self.composition_count.read() + 1_u256;
            let caller = get_caller_address();
            let block = get_block_number();

            let data = CompositionData {
                seed,
                scale,
                rhythm_density,
                bpm,
                composer_starknet: caller,
                composer_solana: solana_recipient,
                block_number: block,
                composition_id,
            };
            self.compositions.write(composition_id, data);
            self.composition_count.write(composition_id);

            self
                .emit(
                    CompositionMinted {
                        composition_id,
                        composer_starknet: caller,
                        composer_solana: solana_recipient,
                        seed,
                        scale,
                        rhythm_density,
                        bpm,
                        block_number: block,
                    },
                );

            let bridge_addr = self.bridge_address.read();
            let zero: ContractAddress = 0_felt252.try_into().unwrap();
            if bridge_addr != zero {
                let mut bridge = IKojiBridgeDispatcher { contract_address: bridge_addr };
                bridge.send_mint_to_solana(composition_id, solana_recipient, seed, scale, rhythm_density, bpm);
            }

            composition_id
        }

        fn get_composition(self: @ContractState, composition_id: u256) -> CompositionData {
            let n = self.composition_count.read();
            assert!(composition_id > 0_u256 && composition_id <= n, "unknown id");
            self.compositions.read(composition_id)
        }

        fn get_composition_midi(self: @ContractState, composition_id: u256) -> Array<felt252> {
            let n = self.composition_count.read();
            assert!(composition_id > 0_u256 && composition_id <= n, "unknown id");
            let comp = self.compositions.read(composition_id);

            // Deterministic generation path from stored params.
            let mode = scale_to_mode(comp.scale);
            let scale_steps = mode_steps(mode);
            let pattern = euclidean(16, comp.rhythm_density.into());

            let seed_low_u8: u8 = (comp.seed.low % 256_u128).try_into().unwrap();
            let tonic = PitchClass { note: seed_low_u8 % 12_u8, octave: 4_u8 };
            let tonic_key = pc_to_keynum(tonic);
            let degree_offset: usize = (seed_low_u8 % 7_u8).into();

            let mut degree_starts: Array<u8> = array![0_u8];
            let mut cumulative: u8 = 0_u8;
            let mut step_i: usize = 0;
            while step_i < 6_usize {
                cumulative = cumulative + (*scale_steps.at(step_i));
                degree_starts.append(cumulative);
                step_i += 1_usize;
            };

            let mut events: Array<Message> = array![];
            events.append(Message::SET_TEMPO(SetTempo { tempo: comp.bpm.into(), time: Option::Some(0) }));
            events.append(Message::PROGRAM_CHANGE(ProgramChange { channel: 0_u8, program: 7_u8, time: 0 }));

            let mut melody_idx: usize = 0;
            let mut i: usize = 0;
            while i < pattern.len() {
                if *pattern.at(i) == 1_u32 {
                    let degree = (melody_idx + degree_offset) % 7_usize;
                    let note = tonic_key + (*degree_starts.at(degree));
                    let step_time: u64 = (i * 240_usize).try_into().unwrap();
                    let off_time = step_time + 180_u64;
                    events.append(
                        Message::NOTE_ON(NoteOn {
                            channel: 0_u8, note, velocity: 96_u8, time: step_time,
                        }),
                    );
                    events.append(
                        Message::NOTE_OFF(NoteOff {
                            channel: 0_u8, note, velocity: 96_u8, time: off_time,
                        }),
                    );
                    melody_idx += 1_usize;
                }
                i += 1_usize;
            };

            let midi = Midi { events: events.span() }
                .generate_harmony(2, tonic, mode);
            let midi_bytes = output_midi_object(@midi);
            to_felt252_array(midi_bytes)
        }

        fn get_composer_compositions(self: @ContractState, composer: ContractAddress) -> Array<u256> {
            let mut out: Array<u256> = array![];
            let n = self.composition_count.read();
            let mut i = 1_u256;
            while i <= n {
                let c = self.compositions.read(i);
                if c.composer_starknet == composer {
                    out.append(i);
                }
                i = i + 1_u256;
            };
            out
        }

        fn composition_count(self: @ContractState) -> u256 {
            self.composition_count.read()
        }
    }
}
