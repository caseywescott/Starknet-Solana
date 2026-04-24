//! KojiComposer — PRD §5.1 (v0.2). Stores composition params and derives MIDI on read.

use starknet::ContractAddress;
use core::traits::TryInto;
use koji::midi::output::to_felt252_array;

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

/// Fallback test MIDI (single-track SMF) used to validate end-to-end bridge + renderer flow
/// before full composition logic is finalized.
fn fallback_test_midi_bytes(note: u8, velocity: u8, program: u8) -> Array<u8> {
    // Header: MThd, length 6, format 0, ntrks 1, division 480
    // Track: tempo 120 BPM, program change, single note, end-of-track.
    array![
        0x4D_u8, 0x54_u8, 0x68_u8, 0x64_u8, 0x00_u8, 0x00_u8, 0x00_u8, 0x06_u8,
        0x00_u8, 0x00_u8, 0x00_u8, 0x01_u8, 0x01_u8, 0xE0_u8, 0x4D_u8, 0x54_u8,
        0x72_u8, 0x6B_u8, 0x00_u8, 0x00_u8, 0x00_u8, 0x14_u8, 0x00_u8, 0xFF_u8,
        0x51_u8, 0x03_u8, 0x07_u8, 0xA1_u8, 0x20_u8, 0x00_u8, 0xC0_u8, program,
        0x00_u8, 0x90_u8, note, velocity, 0x83_u8, 0x60_u8, 0x80_u8, note,
        0x40_u8, 0x00_u8, 0xFF_u8, 0x2F_u8, 0x00_u8
    ]
}

fn fallback_felt_payload_for_params(scale: u8, rhythm_density: u8, bpm: u16) -> Array<felt252> {
    // Lightweight param-aware fallback so end-to-end infra can be tested now.
    let note = 60_u8 + (scale % 12_u8);
    let velocity = 40_u8 + (rhythm_density * 4_u8);
    let program: u8 = (bpm / 2_u16).try_into().unwrap();
    to_felt252_array(fallback_test_midi_bytes(note, velocity, program))
}

#[starknet::contract]
pub mod KojiComposer {
    use super::{CompositionData, CompositionMinted, IKojiComposer};
    use crate::bridge::{IKojiBridgeDispatcher, IKojiBridgeDispatcherTrait};
    use super::fallback_felt_payload_for_params;
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

            fallback_felt_payload_for_params(comp.scale, comp.rhythm_density, comp.bpm)
        }

        fn get_composer_compositions(self: @ContractState, composer: ContractAddress) -> Array<u256> {
            let mut out: Array<u256> = array![];
            let n = self.composition_count.read();
            let mut i = 0_u256;
            while i != n {
                i = i + 1_u256;
                let c = self.compositions.read(i);
                if c.composer_starknet == composer {
                    out.append(i);
                }
            };
            out
        }

        fn composition_count(self: @ContractState) -> u256 {
            self.composition_count.read()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{fallback_felt_payload_for_params, fallback_test_midi_bytes};

    #[test]
    fn fallback_payload_reflects_note_velocity_program() {
        let note_a = 60_u8;
        let vel_a = 64_u8;
        let prog_a = 10_u8;
        let midi_a = fallback_test_midi_bytes(note_a, vel_a, prog_a);

        let note_b = 66_u8;
        let vel_b = 92_u8;
        let prog_b = 35_u8;
        let midi_b = fallback_test_midi_bytes(note_b, vel_b, prog_b);

        assert!(*midi_a.at(31_usize) == prog_a, "program A mismatch");
        assert!(*midi_a.at(34_usize) == note_a, "note-on A mismatch");
        assert!(*midi_a.at(35_usize) == vel_a, "velocity A mismatch");
        assert!(*midi_a.at(39_usize) == note_a, "note-off A mismatch");

        assert!(*midi_b.at(31_usize) == prog_b, "program B mismatch");
        assert!(*midi_b.at(34_usize) == note_b, "note-on B mismatch");
        assert!(*midi_b.at(35_usize) == vel_b, "velocity B mismatch");
        assert!(*midi_b.at(39_usize) == note_b, "note-off B mismatch");

        assert!(midi_a.len() == midi_b.len(), "fallback midi length changed");
        assert!(*midi_a.at(31_usize) != *midi_b.at(31_usize), "program should vary");
        assert!(*midi_a.at(34_usize) != *midi_b.at(34_usize), "note should vary");
        assert!(*midi_a.at(35_usize) != *midi_b.at(35_usize), "velocity should vary");
    }

    #[test]
    fn fallback_felt_payload_changes_with_mint_params() {
        let felts_a = fallback_felt_payload_for_params(0_u8, 4_u8, 100_u16);
        let felts_b = fallback_felt_payload_for_params(5_u8, 12_u8, 180_u16);

        assert!(felts_a.len() == felts_b.len(), "felt payload length should stay stable");
        assert!(*felts_a.at(2_usize) != *felts_b.at(2_usize), "encoded chunk should vary by params");
    }
}
